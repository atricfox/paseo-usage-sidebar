import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import type { PluginSettings } from "@getpaseo/plugin/server";
import { z } from "zod";
import type {
  OpenCodeGoErrorCode,
  OpenCodeGoStatus,
  OpenCodeLocalStats,
  OpenCodePeriodStats,
  OpenCodeUsageResult,
} from "../shared/opencode";
import { openCodeUsageRpc } from "../shared/opencode";
import type { usageSidebarSettings } from "../shared/settings";
import {
  findOpenCodeBinary,
  listOpenCodeIntegrations,
  readOpenCodeV1Key,
  readOpenCodeV2ApiKey,
  runOpenCodeCli,
} from "./opencode-cli";

const OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const LOCAL_CONFIG_DISPLAY_PATH = "~/.paseo/usage-sidebar.json";
const REQUEST_TIMEOUT_MS = 12_000;

const localConfigSchema = z
  .object({
    opencodeGoApiKey: z.string().optional(),
  })
  .passthrough();

const goWindowSchema = z.object({
  status: z.enum(["ok", "rate-limited"]),
  percent: z.number().finite(),
  resetsAt: z.string(),
});

const goResponseSchema = z.object({
  usage: z.object({
    rolling: goWindowSchema,
    weekly: goWindowSchema,
    monthly: goWindowSchema,
  }),
});

const statsTokensSchema = z.object({
  input: z.number().default(0),
  output: z.number().default(0),
  reasoning: z.number().default(0),
  cache: z
    .object({
      read: z.number().default(0),
      write: z.number().default(0),
    })
    .default({ read: 0, write: 0 }),
});

const cliStatsSchema = z.object({
  sessions: z.number().default(0),
  prompts: z.number().default(0),
  steps: z.number().default(0),
  tokens: statsTokensSchema.default({
    input: 0,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
  }),
  cost: z.number().default(0),
  models: z
    .array(
      z.object({
        model: z.object({
          id: z.string(),
          providerID: z.string().default("opencode"),
          variant: z.string().optional(),
        }),
        steps: z.number().default(0),
        tokens: statsTokensSchema.default({
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        }),
        cost: z.number().default(0),
      }),
    )
    .default([]),
});

type ResolvedGoKey =
  | {
      kind: "found";
      apiKey: string;
      source: "env" | "config" | "opencode-v1" | "opencode-v2";
    }
  | { kind: "missing" }
  | { kind: "config_error"; code: OpenCodeGoErrorCode };

async function resolveOpenCodeGoKey(
  reuseOpenCodeCredentials: boolean,
): Promise<ResolvedGoKey> {
  const envKey = process.env.OPENCODE_GO_API_KEY?.trim();
  if (envKey) {
    return { kind: "found", apiKey: envKey, source: "env" };
  }

  const configPath = join(homedir(), ".paseo", "usage-sidebar.json");
  try {
    const raw = await readFile(configPath, "utf8");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return { kind: "config_error", code: "config_invalid_json" };
    }
    const parsed = localConfigSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { kind: "config_error", code: "config_invalid_schema" };
    }
    const fileKey = parsed.data.opencodeGoApiKey?.trim();
    if (fileKey) {
      return { kind: "found", apiKey: fileKey, source: "config" };
    }
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code !== "ENOENT") {
      return { kind: "config_error", code: "config_read_failed" };
    }
  }

  if (reuseOpenCodeCredentials) {
    const v1Key = await readOpenCodeV1Key("opencode-go");
    if (v1Key) {
      return { kind: "found", apiKey: v1Key, source: "opencode-v1" };
    }

    const v2Key = await readOpenCodeV2ApiKey(["opencode-go", "opencode go", "opencode-zen"]);
    if (v2Key) {
      return { kind: "found", apiKey: v2Key, source: "opencode-v2" };
    }
  }

  return { kind: "missing" };
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

async function fetchOpenCodeGoStatus(
  reuseOpenCodeCredentials: boolean,
): Promise<OpenCodeGoStatus> {
  const resolved = await resolveOpenCodeGoKey(reuseOpenCodeCredentials);
  if (resolved.kind === "missing") {
    return {
      status: "unconfigured",
      configPath: LOCAL_CONFIG_DISPLAY_PATH,
    };
  }
  if (resolved.kind === "config_error") {
    return {
      status: "error",
      source: "config",
      code: resolved.code,
      configPath: LOCAL_CONFIG_DISPLAY_PATH,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENCODE_GO_USAGE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${resolved.apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        status: "error",
        source: resolved.source,
        httpStatus: response.status,
        code: "auth_failed",
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        source: resolved.source,
        httpStatus: response.status,
        code: "http_error",
      };
    }

    const parsed = goResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        status: "error",
        source: resolved.source,
        code: "unexpected_schema",
      };
    }

    const entries = [
      ["rolling", "Rolling", "5h", parsed.data.usage.rolling],
      ["weekly", "Weekly", "wk", parsed.data.usage.weekly],
      ["monthly", "Monthly", "mo", parsed.data.usage.monthly],
    ] as const;

    return {
      status: "available",
      source: resolved.source,
      windows: entries.map(([id, label, shortLabel, win]) => {
        const usedPct = clampPercent(win.percent);
        return {
          id,
          label,
          shortLabel,
          status: win.status,
          usedPct,
          remainingPct: clampPercent(100 - usedPct),
          resetsAt: win.resetsAt,
        };
      }),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return {
      status: "error",
      source: resolved.source,
      code: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sumTokens(tokens: z.infer<typeof statsTokensSchema>): number {
  return (
    tokens.input +
    tokens.output +
    tokens.reasoning +
    tokens.cache.read +
    tokens.cache.write
  );
}

function isFreeOpenCodeModel(providerId: string, modelId: string, costUsd: number): boolean {
  if (costUsd > 0) return false;
  const lowerProvider = providerId.toLowerCase();
  const lowerModel = modelId.toLowerCase();
  return lowerProvider === "opencode" || /(?:^|[-_/])free$/i.test(lowerModel);
}

function normalizePeriodStats(raw: z.infer<typeof cliStatsSchema>): OpenCodePeriodStats {
  const allModels = raw.models.map((entry) => {
    const totalTokens = sumTokens(entry.tokens);
    const isFree = isFreeOpenCodeModel(entry.model.providerID, entry.model.id, entry.cost);
    return {
      id: entry.model.id,
      providerId: entry.model.providerID,
      variant: entry.model.variant,
      steps: entry.steps,
      totalTokens,
      costUsd: entry.cost,
      isFree,
    };
  });

  let paidTokens = 0;
  let paidSteps = 0;
  let freeTokens = 0;
  let freeModelCount = 0;

  for (const model of allModels) {
    if (model.isFree) {
      freeTokens += model.totalTokens;
      freeModelCount += 1;
    } else {
      paidTokens += model.totalTokens;
      paidSteps += model.steps;
    }
  }

  const paidModels = allModels
    .filter((item) => !item.isFree)
    .sort((left, right) => right.costUsd - left.costUsd || right.totalTokens - left.totalTokens)
    .slice(0, 8);
  const freeModels = allModels
    .filter((item) => item.isFree)
    .sort((left, right) => right.totalTokens - left.totalTokens)
    .slice(0, 6);

  return {
    sessions: raw.sessions,
    prompts: raw.prompts,
    steps: raw.steps,
    inputTokens: raw.tokens.input,
    outputTokens: raw.tokens.output,
    reasoningTokens: raw.tokens.reasoning,
    cacheReadTokens: raw.tokens.cache.read,
    cacheWriteTokens: raw.tokens.cache.write,
    totalTokens: sumTokens(raw.tokens),
    paidTokens,
    paidSteps,
    freeTokens,
    freeModelCount,
    costUsd: raw.cost,
    models: [...paidModels, ...freeModels],
  };
}

async function fetchOpenCodeLocalStats(): Promise<OpenCodeLocalStats> {
  const binary = await findOpenCodeBinary();
  if (!binary) {
    return {
      status: "unavailable",
      code: "cli_not_found",
    };
  }

  try {
    const [todayRaw, weekRaw, integrations] = await Promise.all([
      runOpenCodeCli(binary, ["stats", "--days", "0", "--cost", "--models", "--json"]),
      runOpenCodeCli(binary, ["stats", "--days", "7", "--cost", "--models", "--json"]),
      listOpenCodeIntegrations(binary),
    ]);

    const todayParsed = cliStatsSchema.safeParse(JSON.parse(todayRaw));
    const weekParsed = cliStatsSchema.safeParse(JSON.parse(weekRaw));
    if (!todayParsed.success || !weekParsed.success) {
      return {
        status: "error",
        code: "parse_failed",
      };
    }

    return {
      status: "available",
      integrations,
      today: normalizePeriodStats(todayParsed.data),
      last7Days: normalizePeriodStats(weekParsed.data),
    };
  } catch {
    return {
      status: "error",
      code: "exec_failed",
    };
  }
}

export function createOpenCodeUsageHandler(
  settings: PluginSettings<typeof usageSidebarSettings.schema>,
) {
  return async function getOpenCodeUsage(
    _input: RpcInput<typeof openCodeUsageRpc>,
  ): Promise<OpenCodeUsageResult> {
    const fetchedAt = new Date().toISOString();

    let reuseOpenCodeCredentials = false;
    try {
      const state = await settings.read();
      if (state.status === "ready") {
        reuseOpenCodeCredentials = state.values.reuseOpenCodeCredentials;
      }
    } catch {
      // Keep opt-in default false when settings cannot be read.
    }

    const [go, localStats] = await Promise.all([
      fetchOpenCodeGoStatus(reuseOpenCodeCredentials),
      fetchOpenCodeLocalStats(),
    ]);
    return { fetchedAt, go, localStats };
  };
}

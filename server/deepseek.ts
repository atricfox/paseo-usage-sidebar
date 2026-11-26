import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import type { PluginSettings } from "@getpaseo/plugin/server";
import { z } from "zod";
import type { DeepSeekBalanceResult, DeepSeekErrorCode } from "../shared/deepseek";
import { deepSeekBalanceRpc } from "../shared/deepseek";
import type { usageSidebarSettings } from "../shared/settings";
import { readOpenCodeV1Key, readOpenCodeV2ApiKey } from "./opencode-cli";
import { readPiApiKey } from "./pi";

const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";
const DEEPSEEK_CONFIG_DISPLAY_PATH = "~/.paseo/usage-sidebar.json";
const REQUEST_TIMEOUT_MS = 12_000;

const localConfigSchema = z
  .object({
    deepseekApiKey: z.string().optional(),
  })
  .passthrough();

const apiResponseSchema = z.object({
  is_available: z.boolean(),
  balance_infos: z.array(
    z.object({
      currency: z.string(),
      total_balance: z.coerce.string(),
      granted_balance: z.coerce.string(),
      topped_up_balance: z.coerce.string(),
    }),
  ),
});

type ResolvedKeyResult =
  | { kind: "found"; apiKey: string; source: "env" | "config" | "opencode" | "pi" }
  | { kind: "missing" }
  | { kind: "config_error"; code: DeepSeekErrorCode };

async function resolveDeepSeekApiKey(
  reuseOpenCodeCredentials: boolean,
): Promise<ResolvedKeyResult> {
  const envKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (envKey) {
    return { kind: "found", apiKey: envKey, source: "env" };
  }

  const configPath = join(homedir(), ".paseo", "usage-sidebar.json");
  let configMissing = false;
  let raw = "";
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "ENOENT") {
      configMissing = true;
    } else {
      return { kind: "config_error", code: "config_read_failed" };
    }
  }

  if (!configMissing) {
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

    const fileKey = parsed.data.deepseekApiKey?.trim();
    if (fileKey) {
      return { kind: "found", apiKey: fileKey, source: "config" };
    }
  }

  if (reuseOpenCodeCredentials) {
    const openCodeKey =
      (await readOpenCodeV2ApiKey(["deepseek"])) ?? (await readOpenCodeV1Key("deepseek"));
    if (openCodeKey) {
      return { kind: "found", apiKey: openCodeKey, source: "opencode" };
    }
    const piKey = await readPiApiKey(["deepseek"]);
    if (piKey) {
      return { kind: "found", apiKey: piKey, source: "pi" };
    }
  }

  return { kind: "missing" };
}

export function createDeepSeekBalanceHandler(
  settings: PluginSettings<typeof usageSidebarSettings.schema>,
) {
  return async function getDeepSeekBalance(
    _input: RpcInput<typeof deepSeekBalanceRpc>,
  ): Promise<DeepSeekBalanceResult> {
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

    const resolved = await resolveDeepSeekApiKey(reuseOpenCodeCredentials);

    if (resolved.kind === "missing") {
      return {
        status: "unconfigured",
        fetchedAt,
        configPath: DEEPSEEK_CONFIG_DISPLAY_PATH,
      };
    }

    if (resolved.kind === "config_error") {
      return {
        status: "error",
        fetchedAt,
        source: "config",
        code: resolved.code,
        configPath: DEEPSEEK_CONFIG_DISPLAY_PATH,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(DEEPSEEK_BALANCE_URL, {
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
          fetchedAt,
          source: resolved.source,
          httpStatus: response.status,
          code: "auth_failed",
        };
      }

      if (response.status === 429) {
        return {
          status: "error",
          fetchedAt,
          source: resolved.source,
          httpStatus: 429,
          code: "rate_limited",
        };
      }

      if (!response.ok) {
        return {
          status: "error",
          fetchedAt,
          source: resolved.source,
          httpStatus: response.status,
          code: "http_error",
        };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return {
          status: "error",
          fetchedAt,
          source: resolved.source,
          code: "invalid_json",
        };
      }

      const parsed = apiResponseSchema.safeParse(body);
      if (!parsed.success) {
        return {
          status: "error",
          fetchedAt,
          source: resolved.source,
          code: "unexpected_schema",
        };
      }

      return {
        status: "available",
        fetchedAt,
        source: resolved.source,
        isAvailable: parsed.data.is_available,
        balances: parsed.data.balance_infos.map((info) => ({
          currency: info.currency,
          totalBalance: info.total_balance,
          grantedBalance: info.granted_balance,
          toppedUpBalance: info.topped_up_balance,
        })),
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      return {
        status: "error",
        fetchedAt,
        source: resolved.source,
        code: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error",
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

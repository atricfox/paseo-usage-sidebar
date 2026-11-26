import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import type { PluginSettings } from "@getpaseo/plugin/server";
import { z } from "zod";
import type {
  PiConfiguredProvider,
  PiOpenRouterCredits,
  PiUsageResult,
} from "../shared/pi";
import { piUsageRpc } from "../shared/pi";
import type { usageSidebarSettings } from "../shared/settings";

const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";
const REQUEST_TIMEOUT_MS = 12_000;

const PASEO_BUILTIN_PI_PROVIDERS = new Set(["anthropic", "openai-codex", "github-copilot"]);

const piEntrySchema = z
  .object({
    type: z.string().optional(),
    key: z.string().optional(),
    apiKey: z.string().optional(),
    access: z.string().optional(),
    accessToken: z.string().optional(),
  })
  .passthrough();

const openRouterResponseSchema = z.object({
  data: z.object({
    total_credits: z.number().finite(),
    total_usage: z.number().finite(),
  }),
});

export function resolvePiAuthPath(): { absolutePath: string; displayPath: string } {
  const home = homedir();
  const configured = process.env.PI_CODING_AGENT_DIR?.trim();
  if (!configured) {
    return {
      absolutePath: join(home, ".pi", "agent", "auth.json"),
      displayPath: "~/.pi/agent/auth.json",
    };
  }
  if (configured === "~") {
    return {
      absolutePath: join(home, "auth.json"),
      displayPath: "~/auth.json",
    };
  }
  const dir = configured.startsWith("~/")
    ? join(home, configured.slice(2))
    : resolve(configured);
  return {
    absolutePath: join(dir, "auth.json"),
    displayPath: "$PI_CODING_AGENT_DIR/auth.json",
  };
}

async function readPiAuthObject(): Promise<
  | { kind: "ok"; data: Record<string, unknown>; displayPath: string }
  | { kind: "not_found"; displayPath: string }
  | { kind: "error"; code: "read_failed" | "invalid_json"; displayPath: string }
> {
  const { absolutePath, displayPath } = resolvePiAuthPath();
  let raw: string;
  try {
    raw = await readFile(absolutePath, "utf8");
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "ENOENT") {
      return { kind: "not_found", displayPath };
    }
    return { kind: "error", code: "read_failed", displayPath };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { kind: "error", code: "invalid_json", displayPath };
  }

  const parsed = z.record(z.string(), z.unknown()).safeParse(parsedJson);
  if (!parsed.success) {
    return { kind: "error", code: "invalid_json", displayPath };
  }

  return { kind: "ok", data: parsed.data, displayPath };
}

function extractApiKeyFromEntry(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const parsed = piEntrySchema.safeParse(raw);
  if (!parsed.success) return null;
  const candidate = parsed.data.key ?? parsed.data.apiKey;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return null;
}

/**
 * Reads an API key for one of `providerIds` from Pi's auth.json purely in memory.
 * Never logs file contents or credential values.
 */
export async function readPiApiKey(providerIds: readonly string[]): Promise<string | null> {
  const store = await readPiAuthObject();
  if (store.kind !== "ok") return null;

  const wanted = new Set(providerIds.map((id) => id.toLowerCase()));
  for (const [key, value] of Object.entries(store.data)) {
    if (!wanted.has(key.toLowerCase())) continue;
    const token = extractApiKeyFromEntry(value);
    if (token) return token;
  }
  return null;
}

function classifyPiEntry(raw: unknown): "oauth" | "api_key" | "other" {
  if (typeof raw === "string" && raw.trim().length > 0) return "api_key";
  const parsed = piEntrySchema.safeParse(raw);
  if (!parsed.success) return "other";
  const type = parsed.data.type?.toLowerCase();
  if (type === "oauth" || parsed.data.access || parsed.data.accessToken) return "oauth";
  if (type === "api_key" || type === "api" || type === "key" || parsed.data.key || parsed.data.apiKey) {
    return "api_key";
  }
  return "other";
}

async function fetchOpenRouterCredits(apiKey: string): Promise<PiOpenRouterCredits> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_CREDITS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { status: "error", httpStatus: response.status, code: "auth_failed" };
    }
    if (!response.ok) {
      return { status: "error", httpStatus: response.status, code: "http_error" };
    }

    const parsed = openRouterResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return { status: "error", code: "unexpected_schema" };
    }

    const total = parsed.data.data.total_credits;
    const used = parsed.data.data.total_usage;
    return {
      status: "available",
      totalCreditsUsd: total,
      usedUsd: used,
      remainingUsd: Math.max(0, total - used),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return {
      status: "error",
      code: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function createPiUsageHandler(
  settings: PluginSettings<typeof usageSidebarSettings.schema>,
) {
  return async function getPiUsage(
    _input: RpcInput<typeof piUsageRpc>,
  ): Promise<PiUsageResult> {
    const fetchedAt = new Date().toISOString();
    const store = await readPiAuthObject();

    if (store.kind === "not_found") {
      return {
        status: "not_found",
        fetchedAt,
        authPathDisplay: store.displayPath,
      };
    }

    if (store.kind === "error") {
      return {
        status: "error",
        fetchedAt,
        authPathDisplay: store.displayPath,
        code: store.code,
      };
    }

    const providers: PiConfiguredProvider[] = Object.entries(store.data)
      .filter(([, value]) => value != null)
      .map(([id, value]) => {
        const authType = classifyPiEntry(value);
        return {
          id,
          authType,
          coveredByPaseoBuiltin:
            authType === "oauth" && PASEO_BUILTIN_PI_PROVIDERS.has(id.toLowerCase()),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    let openRouter: PiOpenRouterCredits | null = null;
    const openRouterKeyEntry = Object.entries(store.data).find(
      ([id]) => id.toLowerCase() === "openrouter",
    );
    if (openRouterKeyEntry) {
      let reusePiCredentials = false;
      try {
        const state = await settings.read();
        if (state.status === "ready") {
          reusePiCredentials = state.values.reusePiCredentials;
        }
      } catch {
        // Keep opt-in default false.
      }
      if (!reusePiCredentials) {
        openRouter = { status: "opt_in_required" };
      } else {
        const key = extractApiKeyFromEntry(openRouterKeyEntry[1]);
        if (key) {
          openRouter = await fetchOpenRouterCredits(key);
        }
      }
    }

    return {
      status: "available",
      fetchedAt,
      authPathDisplay: store.displayPath,
      providers,
      openRouter,
    };
  };
}

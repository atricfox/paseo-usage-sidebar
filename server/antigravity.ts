import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { RpcInput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { z } from "zod";
import type { AntigravityGroup, AntigravityUsageResult } from "../shared/antigravity";
import { antigravityUsageRpc } from "../shared/antigravity";

const execFileAsync = promisify(execFile);

const CACHE_TTL_MS = 120_000;
const CACHE_TTL_SECONDS = Math.round(CACHE_TTL_MS / 1000);
const CLI_TIMEOUT_MS = 20_000;
const CLI_MAX_BUFFER = 2 * 1024 * 1024;

const agyUsageResponseSchema = z.object({
  status: z.string(),
  command: z
    .object({
      name: z.string().optional(),
      data: z
        .object({
          groups: z
            .array(
              z.object({
                name: z.string(),
                description: z.string().optional(),
                buckets: z.array(
                  z.object({
                    id: z.string(),
                    name: z.string(),
                    description: z.string().optional(),
                    window: z.string().default("unknown"),
                    remaining_fraction: z.number().finite(),
                    reset_time: z.string().nullish(),
                  }),
                ),
              }),
            )
            .default([]),
        })
        .optional(),
    })
    .optional(),
});

const agyCreditsResponseSchema = z.object({
  status: z.string(),
  command: z
    .object({
      name: z.string().optional(),
      data: z
        .object({
          remaining_credits: z.number().finite().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

const providerEnvSchema = z.object({
  agents: z
    .object({
      providers: z
        .object({
          antigravity: z
            .object({
              env: z.record(z.string(), z.string()).optional(),
              command: z.union([z.string(), z.array(z.string())]).optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
});

interface CacheEntry {
  expiresAt: number;
  result: Extract<AntigravityUsageResult, { status: "available" }>;
}

let cachedResult: CacheEntry | null = null;
let inFlightFetch: Promise<AntigravityUsageResult> | null = null;

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findAgyBinary(configuredCommand?: string | string[]): Promise<string | null> {
  const home = homedir();
  const pathDirs = (process.env.PATH ?? "").split(":").filter(Boolean);
  const configuredBin = Array.isArray(configuredCommand)
    ? configuredCommand[0]
    : configuredCommand;

  const candidates = [
    ...(configuredBin ? [configuredBin] : []),
    ...pathDirs.map((dir) => join(dir, "agy")),
    join(home, ".local", "bin", "agy"),
    join(home, ".gemini", "antigravity-cli", "bin", "agy"),
    "/opt/homebrew/bin/agy",
    "/usr/local/bin/agy",
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (candidate.includes("/") && (await isExecutable(candidate))) {
      return candidate;
    }
  }
  return null;
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 10) / 10;
}

async function readAntigravityProviderConfig(
  context: PluginHandlerContext,
): Promise<{ env: Record<string, string>; command?: string | string[] }> {
  try {
    const { config } = await context.paseo.config.get();
    const parsed = providerEnvSchema.safeParse(config);
    if (!parsed.success) return { env: {} };
    const agyConfig = parsed.data.agents?.providers?.antigravity;
    return {
      env: agyConfig?.env ?? {},
      command: agyConfig?.command,
    };
  } catch {
    return { env: {} };
  }
}

async function runAgyCommand(
  binary: string,
  slashCommand: "/usage" | "/credits",
  extraEnv: Record<string, string>,
): Promise<string> {
  const home = homedir();
  const extraDirs = [
    join(home, ".local", "bin"),
    join(home, ".gemini", "antigravity-cli", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const mergedPath = [...extraDirs, ...(process.env.PATH ? [process.env.PATH] : [])].join(":");

  const { stdout } = await execFileAsync(
    binary,
    ["-p", slashCommand, "--output-format", "json", "--print-timeout", "15s"],
    {
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: CLI_MAX_BUFFER,
      env: {
        ...process.env,
        ...extraEnv,
        PATH: mergedPath,
        NO_COLOR: "1",
      },
    },
  );
  return stdout;
}

function parseJsonLineOrDoc(stdout: string): unknown {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fallback if CLI prints preamble lines before the final JSON line.
    const lines = trimmed.split(/\r?\n/).reverse();
    for (const line of lines) {
      const candidate = line.trim();
      if (!candidate.startsWith("{")) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }
    throw new Error("Invalid JSON output");
  }
}

async function fetchAntigravityUsageLive(
  context: PluginHandlerContext,
): Promise<AntigravityUsageResult> {
  const fetchedAt = new Date().toISOString();
  const providerConfig = await readAntigravityProviderConfig(context);
  const binary = await findAgyBinary(providerConfig.command);

  if (!binary) {
    return {
      status: "unavailable",
      fetchedAt,
      code: "cli_not_found",
    };
  }

  try {
    const [usageStdout, creditsOutcome] = await Promise.all([
      runAgyCommand(binary, "/usage", providerConfig.env),
      runAgyCommand(binary, "/credits", providerConfig.env).catch(() => null),
    ]);

    const parsedUsage = agyUsageResponseSchema.safeParse(parseJsonLineOrDoc(usageStdout));
    if (!parsedUsage.success || parsedUsage.data.status !== "SUCCESS") {
      return {
        status: "error",
        fetchedAt,
        code: "status_error",
      };
    }

    const rawGroups = parsedUsage.data.command?.data?.groups ?? [];
    const groups: AntigravityGroup[] = rawGroups.map((group) => ({
      name: group.name,
      description: group.description,
      buckets: group.buckets.map((bucket) => {
        const remainingPct = clampPercent(bucket.remaining_fraction * 100);
        return {
          id: bucket.id,
          name: bucket.name,
          window: bucket.window,
          description: bucket.description,
          remainingPct,
          usedPct: clampPercent(100 - remainingPct),
          resetsAt: bucket.reset_time ?? null,
        };
      }),
    }));

    let remainingCredits: number | null = null;
    if (creditsOutcome) {
      try {
        const parsedCredits = agyCreditsResponseSchema.safeParse(
          parseJsonLineOrDoc(creditsOutcome),
        );
        if (
          parsedCredits.success &&
          parsedCredits.data.status === "SUCCESS" &&
          typeof parsedCredits.data.command?.data?.remaining_credits === "number"
        ) {
          remainingCredits = parsedCredits.data.command.data.remaining_credits;
        }
      } catch {
        // Keep credits null when /credits parsing fails; /usage groups still succeed.
      }
    }

    const result: Extract<AntigravityUsageResult, { status: "available" }> = {
      status: "available",
      fetchedAt,
      cached: false,
      cacheTtlSeconds: CACHE_TTL_SECONDS,
      groups,
      remainingCredits,
    };

    cachedResult = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result,
    };

    return result;
  } catch (error) {
    const killed = (error as { killed?: unknown } | null)?.killed === true;
    return {
      status: "error",
      fetchedAt,
      code: killed ? "timeout" : "exec_failed",
    };
  }
}

export async function getAntigravityUsage(
  input: RpcInput<typeof antigravityUsageRpc>,
  context: PluginHandlerContext,
): Promise<AntigravityUsageResult> {
  const forceRefresh = input.forceRefresh === true;

  if (!forceRefresh && cachedResult && Date.now() < cachedResult.expiresAt) {
    return {
      ...cachedResult.result,
      cached: true,
    };
  }

  if (!forceRefresh && inFlightFetch) {
    return inFlightFetch;
  }

  const request = fetchAntigravityUsageLive(context).finally(() => {
    if (inFlightFetch === request) {
      inFlightFetch = null;
    }
  });
  inFlightFetch = request;
  return request;
}

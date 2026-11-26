import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
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

const profileSchema = z.object({
  label: z.string().optional(),
  enabled: z.boolean().optional(),
  env: z.record(z.string(), z.string()).default({}),
  command: z.union([z.string(), z.array(z.string())]).optional(),
});
type Profile = z.infer<typeof profileSchema>;

const cache = new Map<string, { expiresAt: number; result: AntigravityUsageResult }>();
const pending = new Map<string, Promise<AntigravityUsageResult>>();

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

async function profiles(context: PluginHandlerContext) {
  // The mutable config RPC omits the daemon's provider launch definitions.
  const home = process.env.PASEO_HOME || join(homedir(), ".paseo");
  let config: unknown;
  try {
    config = JSON.parse(await readFile(join(home, "config.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    ({ config } = await context.paseo.config.get());
  }
  const data = z.object({
    agents: z.object({ providers: z.record(z.string(), z.unknown()).optional() }).optional(),
  }).parse(config);
  const entries = { antigravity: {}, ...data.agents?.providers };
  return Object.entries(entries).flatMap(([id, raw]) => {
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success || parsed.data.enabled === false) return [];
    const profile = parsed.data;
    const argv = profile.command;
    const isAgy = Array.isArray(argv) && basename(argv[0] ?? "") === "agy" && argv.includes("acp");
    return id === "antigravity" || isAgy ? [{ id, profile }] : [];
  });
}

function directoryFlag(argv: string[], name: string, fallback: string) {
  for (const [index, arg] of argv.entries()) {
    const flag = arg.replaceAll("_", "-");
    if (flag === name) return argv[index + 1] ?? fallback;
    if (flag.startsWith(name + "=")) return arg.slice(name.length + 1);
  }
  return fallback;
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
  providerConfig: Profile,
): Promise<AntigravityUsageResult> {
  const fetchedAt = new Date().toISOString();
  const binary = await findAgyBinary(providerConfig.command);

  if (!binary) {
    return {
      status: "unavailable",
      fetchedAt,
      code: "cli_not_found",
    };
  }

  let temporaryHome: string | undefined;
  try {
    let env = providerConfig.env;
    const argv = Array.isArray(providerConfig.command) ? providerConfig.command : [];
    const geminiDir = directoryFlag(argv, "--gemini-dir", ".gemini");
    const appDir = directoryFlag(argv, "--app-data-dir", "antigravity-cli");
    if (geminiDir !== ".gemini" || appDir !== "antigravity-cli") {
      // Print mode uses fixed directory names. Point it at the same store as ACP.
      const store = resolve(env.HOME || homedir(), geminiDir, appDir);
      await access(store);
      temporaryHome = await mkdtemp(join(tmpdir(), "paseo-agy-"));
      const gemini = join(temporaryHome, ".gemini");
      await mkdir(gemini);
      await symlink(store, join(gemini, "antigravity-cli"), "dir");
      env = { ...env, HOME: temporaryHome };
    }
    const [usageStdout, creditsOutcome] = await Promise.all([
      runAgyCommand(binary, "/usage", env),
      runAgyCommand(binary, "/credits", env).catch(() => null),
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

    return result;
  } catch (error) {
    const killed = (error as { killed?: unknown } | null)?.killed === true;
    return {
      status: "error",
      fetchedAt,
      code: killed ? "timeout" : "exec_failed",
    };
  } finally {
    if (temporaryHome) await rm(temporaryHome, { recursive: true, force: true });
  }
}

async function quotaFor(profile: Profile, id: string, force: boolean) {
  const key = JSON.stringify([id, profile]);
  const cached = cache.get(key);
  if (!force && cached && cached.expiresAt > Date.now() && cached.result.status === "available") {
    return { ...cached.result, cached: true };
  }
  const existing = pending.get(key);
  if (existing) return existing;
  const request = fetchAntigravityUsageLive(profile).then((result) => {
    if (result.status === "available") cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export async function getAccountUsage(input: { forceRefresh?: boolean }, context: PluginHandlerContext) {
  const entries = await profiles(context);
  return Promise.all(entries.map(async ({ id, profile }) => ({
    id,
    label: profile.label || (id === "antigravity" ? (entries.length > 1 ? "Antigravity A" : "Antigravity") : id),
    quota: await quotaFor(profile, id, !!input.forceRefresh),
  })));
}

export async function getAntigravityUsage(input: RpcInput<typeof antigravityUsageRpc>, context: PluginHandlerContext) {
  const entries = await profiles(context);
  const main = entries.find(({ id }) => id === "antigravity");
  if (main) return quotaFor(main.profile, main.id, !!input.forceRefresh);
  return { status: "unavailable" as const, fetchedAt: new Date().toISOString(), code: "cli_not_found" as const };
}

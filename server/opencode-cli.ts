import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const CLI_TIMEOUT_MS = 10_000;
const CLI_MAX_BUFFER = 4 * 1024 * 1024;

const exportedCredentialSchema = z.array(
  z.object({
    integrationID: z.string(),
    label: z.string().optional(),
    active: z.boolean().optional(),
    value: z
      .object({
        type: z.string(),
        key: z.string().optional(),
        access: z.string().optional(),
      })
      .passthrough(),
  }),
);

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findOpenCodeBinary(): Promise<string | null> {
  const home = homedir();
  const pathDirs = (process.env.PATH ?? "").split(":").filter(Boolean);
  const candidates = [
    ...pathDirs.map((dir) => join(dir, "opencode")),
    join(home, ".local", "share", "mise", "installs", "node", "lts", "bin", "opencode"),
    join(home, ".local", "share", "mise", "shims", "opencode"),
    join(home, ".local", "bin", "opencode"),
    "/opt/homebrew/bin/opencode",
    "/usr/local/bin/opencode",
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function runOpenCodeCli(
  binary: string,
  args: readonly string[],
): Promise<string> {
  const home = homedir();
  const extraDirs = [
    join(home, ".local", "share", "mise", "installs", "node", "lts", "bin"),
    join(home, ".local", "share", "mise", "shims"),
    join(home, ".local", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const mergedPath = [...extraDirs, ...(process.env.PATH ? [process.env.PATH] : [])].join(":");

  const { stdout } = await execFileAsync(binary, [...args], {
    timeout: CLI_TIMEOUT_MS,
    maxBuffer: CLI_MAX_BUFFER,
    env: {
      ...process.env,
      PATH: mergedPath,
      NO_COLOR: "1",
    },
  });
  return stdout;
}

export async function readOpenCodeV1Key(providerKey: string): Promise<string | null> {
  const home = homedir();
  const base = process.env.XDG_DATA_HOME || join(home, ".local", "share");
  const authPath = join(base, "opencode", "auth.json");
  try {
    const raw = await readFile(authPath, "utf8");
    const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const entry = parsed.data[providerKey];
    const keySchema = z.object({
      type: z.enum(["api", "key"]).optional(),
      key: z.string().min(1),
    });
    const matched = keySchema.safeParse(entry);
    return matched.success ? matched.data.key.trim() || null : null;
  } catch {
    return null;
  }
}

/**
 * Reads a stored API key from OpenCode v2 (`opencode auth export`) purely in memory.
 * Never logs raw stdout, stderr, or credential values.
 */
export async function readOpenCodeV2ApiKey(
  integrationIds: readonly string[],
): Promise<string | null> {
  const binary = await findOpenCodeBinary();
  if (!binary) return null;

  try {
    const stdout = await runOpenCodeCli(binary, ["auth", "export"]);
    const parsed = exportedCredentialSchema.safeParse(JSON.parse(stdout));
    if (!parsed.success) return null;

    const wanted = new Set(integrationIds.map((id) => id.toLowerCase()));
    const matches = parsed.data.filter(
      (entry) =>
        (wanted.has(entry.integrationID.toLowerCase()) ||
          (entry.label ? wanted.has(entry.label.toLowerCase()) : false)) &&
        (entry.value.type === "key" || entry.value.type === "api") &&
        typeof entry.value.key === "string" &&
        entry.value.key.trim().length > 0,
    );

    const preferred = matches.find((entry) => entry.active === true) ?? matches[0];
    return preferred?.value.key?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function listOpenCodeIntegrations(binary: string): Promise<string[]> {
  try {
    const stdout = await runOpenCodeCli(binary, ["auth", "list"]);
    const names: string[] = [];
    for (const rawLine of stdout.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      // Format: "<label>  <provider>  stored"
      const cols = line.split(/\s{2,}/).filter(Boolean);
      const label = cols[0]?.trim();
      if (label && !names.includes(label)) {
        names.push(label);
      }
    }
    return names;
  } catch {
    return [];
  }
}

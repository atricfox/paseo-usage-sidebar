import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const openCodeGoWindowSchema = z.object({
  id: z.enum(["rolling", "weekly", "monthly"]),
  label: z.string(),
  shortLabel: z.string(),
  status: z.enum(["ok", "rate-limited"]),
  usedPct: z.number(),
  remainingPct: z.number(),
  resetsAt: z.string(),
});

export type OpenCodeGoWindow = z.infer<typeof openCodeGoWindowSchema>;

export const openCodeGoSourceSchema = z.enum([
  "env",
  "config",
  "opencode-v1",
  "opencode-v2",
  "pi",
]);

export const openCodeGoErrorCodeSchema = z.enum([
  "config_read_failed",
  "config_invalid_json",
  "config_invalid_schema",
  "auth_failed",
  "http_error",
  "unexpected_schema",
  "timeout",
  "network_error",
]);

export type OpenCodeGoErrorCode = z.infer<typeof openCodeGoErrorCodeSchema>;

export const openCodeGoStatusSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    source: openCodeGoSourceSchema,
    windows: z.array(openCodeGoWindowSchema),
  }),
  z.object({
    status: z.literal("unconfigured"),
    configPath: z.string(),
  }),
  z.object({
    status: z.literal("error"),
    source: openCodeGoSourceSchema.optional(),
    httpStatus: z.number().int().optional(),
    code: openCodeGoErrorCodeSchema,
    configPath: z.string().optional(),
  }),
]);

export type OpenCodeGoStatus = z.infer<typeof openCodeGoStatusSchema>;

export const openCodeModelStatsSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  variant: z.string().optional(),
  steps: z.number(),
  totalTokens: z.number(),
  costUsd: z.number(),
  isFree: z.boolean(),
});

export type OpenCodeModelStats = z.infer<typeof openCodeModelStatsSchema>;

export const openCodePeriodStatsSchema = z.object({
  sessions: z.number(),
  prompts: z.number(),
  steps: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  reasoningTokens: z.number(),
  cacheReadTokens: z.number(),
  cacheWriteTokens: z.number(),
  totalTokens: z.number(),
  paidTokens: z.number(),
  paidSteps: z.number(),
  freeTokens: z.number(),
  freeModelCount: z.number(),
  costUsd: z.number(),
  models: z.array(openCodeModelStatsSchema),
});

export type OpenCodePeriodStats = z.infer<typeof openCodePeriodStatsSchema>;

export const openCodeLocalErrorCodeSchema = z.enum([
  "cli_not_found",
  "parse_failed",
  "exec_failed",
]);

export type OpenCodeLocalErrorCode = z.infer<typeof openCodeLocalErrorCodeSchema>;

export const openCodeLocalStatsSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    integrations: z.array(z.string()),
    today: openCodePeriodStatsSchema,
    last7Days: openCodePeriodStatsSchema,
  }),
  z.object({
    status: z.literal("unavailable"),
    code: openCodeLocalErrorCodeSchema,
  }),
  z.object({
    status: z.literal("error"),
    code: openCodeLocalErrorCodeSchema,
  }),
]);

export type OpenCodeLocalStats = z.infer<typeof openCodeLocalStatsSchema>;

export const openCodeUsageOutputSchema = z.object({
  fetchedAt: z.string(),
  go: openCodeGoStatusSchema,
  localStats: openCodeLocalStatsSchema,
});

export type OpenCodeUsageResult = z.infer<typeof openCodeUsageOutputSchema>;

export const openCodeUsageRpc = defineRpc({
  name: "opencode.usage",
  input: z.object({
    forceRefresh: z.boolean().optional(),
  }),
  output: openCodeUsageOutputSchema,
});

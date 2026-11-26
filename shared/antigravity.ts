import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const antigravityBucketSchema = z.object({
  id: z.string(),
  name: z.string(),
  window: z.string(),
  description: z.string().optional(),
  remainingPct: z.number(),
  usedPct: z.number(),
  resetsAt: z.string().nullable(),
});

export type AntigravityBucket = z.infer<typeof antigravityBucketSchema>;

export const antigravityGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  buckets: z.array(antigravityBucketSchema),
});

export type AntigravityGroup = z.infer<typeof antigravityGroupSchema>;

export const antigravityErrorCodeSchema = z.enum([
  "cli_not_found",
  "status_error",
  "timeout",
  "exec_failed",
]);

export type AntigravityErrorCode = z.infer<typeof antigravityErrorCodeSchema>;

export const antigravityUsageOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    fetchedAt: z.string(),
    cached: z.boolean(),
    cacheTtlSeconds: z.number().int(),
    groups: z.array(antigravityGroupSchema),
    remainingCredits: z.number().nullable(),
  }),
  z.object({
    status: z.literal("unavailable"),
    fetchedAt: z.string(),
    code: antigravityErrorCodeSchema,
  }),
  z.object({
    status: z.literal("error"),
    fetchedAt: z.string(),
    code: antigravityErrorCodeSchema,
  }),
]);

export type AntigravityUsageResult = z.infer<typeof antigravityUsageOutputSchema>;

export const antigravityUsageRpc = defineRpc({
  name: "antigravity.usage",
  input: z.object({
    forceRefresh: z.boolean().optional(),
  }),
  output: antigravityUsageOutputSchema,
});

const accountUsageSchema = z.object({
  id: z.string(),
  label: z.string(),
  quota: antigravityUsageOutputSchema,
});

export type AntigravityAccountUsage = z.infer<typeof accountUsageSchema>;

export const accountUsageRpc = defineRpc({
  name: "antigravity.accounts",
  input: z.object({ forceRefresh: z.boolean().optional() }),
  output: z.array(accountUsageSchema),
});

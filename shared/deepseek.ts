import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const deepSeekBalanceInfoSchema = z.object({
  currency: z.string(),
  totalBalance: z.string(),
  grantedBalance: z.string(),
  toppedUpBalance: z.string(),
});

export type DeepSeekBalanceInfo = z.infer<typeof deepSeekBalanceInfoSchema>;

export const deepSeekBalanceSourceSchema = z.enum(["env", "config", "opencode", "pi"]);

export const deepSeekErrorCodeSchema = z.enum([
  "config_read_failed",
  "config_invalid_json",
  "config_invalid_schema",
  "auth_failed",
  "rate_limited",
  "http_error",
  "invalid_json",
  "unexpected_schema",
  "timeout",
  "network_error",
]);

export type DeepSeekErrorCode = z.infer<typeof deepSeekErrorCodeSchema>;

export const deepSeekBalanceOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    fetchedAt: z.string(),
    source: deepSeekBalanceSourceSchema,
    isAvailable: z.boolean(),
    balances: z.array(deepSeekBalanceInfoSchema),
  }),
  z.object({
    status: z.literal("unconfigured"),
    fetchedAt: z.string(),
    configPath: z.string(),
  }),
  z.object({
    status: z.literal("error"),
    fetchedAt: z.string(),
    source: deepSeekBalanceSourceSchema.optional(),
    httpStatus: z.number().int().optional(),
    code: deepSeekErrorCodeSchema,
    configPath: z.string().optional(),
  }),
]);

export type DeepSeekBalanceResult = z.infer<typeof deepSeekBalanceOutputSchema>;

export const deepSeekBalanceRpc = defineRpc({
  name: "deepseek.balance",
  input: z.object({
    forceRefresh: z.boolean().optional(),
  }),
  output: deepSeekBalanceOutputSchema,
});

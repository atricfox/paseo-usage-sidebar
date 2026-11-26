import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const piConfiguredProviderSchema = z.object({
  id: z.string(),
  authType: z.enum(["oauth", "api_key", "other"]),
  coveredByPaseoBuiltin: z.boolean(),
});

export type PiConfiguredProvider = z.infer<typeof piConfiguredProviderSchema>;

export const piOpenRouterCreditsSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    totalCreditsUsd: z.number(),
    usedUsd: z.number(),
    remainingUsd: z.number(),
  }),
  z.object({
    status: z.literal("opt_in_required"),
  }),
  z.object({
    status: z.literal("error"),
    httpStatus: z.number().int().optional(),
    code: z.enum(["auth_failed", "http_error", "unexpected_schema", "timeout", "network_error"]),
  }),
]);

export type PiOpenRouterCredits = z.infer<typeof piOpenRouterCreditsSchema>;

export const piUsageOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    fetchedAt: z.string(),
    authPathDisplay: z.string(),
    providers: z.array(piConfiguredProviderSchema),
    openRouter: piOpenRouterCreditsSchema.nullable(),
  }),
  z.object({
    status: z.literal("not_found"),
    fetchedAt: z.string(),
    authPathDisplay: z.string(),
  }),
  z.object({
    status: z.literal("error"),
    fetchedAt: z.string(),
    authPathDisplay: z.string(),
    code: z.enum(["read_failed", "invalid_json"]),
  }),
]);

export type PiUsageResult = z.infer<typeof piUsageOutputSchema>;

export const piUsageRpc = defineRpc({
  name: "pi.usage",
  input: z.object({
    forceRefresh: z.boolean().optional(),
  }),
  output: piUsageOutputSchema,
});

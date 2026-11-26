import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const usageSidebarSettings = defineSettings({
  id: "display",
  scope: "host",
  version: 2,
  schema: z.object({
    hiddenIds: z.array(z.string()).default([]),
    reuseOpenCodeCredentials: z.boolean().default(false),
    showOpenCodeFreeModels: z.boolean().default(false),
  }),
  migrate(values, fromVersion) {
    if (fromVersion === 1 && values && typeof values === "object") {
      const legacy = values as Record<string, unknown>;
      return {
        hiddenIds: Array.isArray(legacy.hiddenIds) ? legacy.hiddenIds : [],
        reuseOpenCodeCredentials:
          typeof legacy.reuseOpenCodeDeepSeekKey === "boolean"
            ? legacy.reuseOpenCodeDeepSeekKey
            : false,
        showOpenCodeFreeModels:
          typeof legacy.showOpenCodeFreeModels === "boolean"
            ? legacy.showOpenCodeFreeModels
            : false,
      };
    }
    return values;
  },
});

export type UsageSidebarSettingsValues = z.infer<typeof usageSidebarSettings.schema>;

export const pluginLanguageSchema = z.enum(["app", "system", "en", "zh-CN"]);
export type PluginLanguagePreference = z.infer<typeof pluginLanguageSchema>;

export const usageSidebarDeviceLayout = defineSettings({
  id: "layout",
  scope: "device",
  version: 1,
  schema: z.object({
    collapsed: z.boolean().default(false),
    language: pluginLanguageSchema.default("app"),
  }),
});

export type UsageSidebarDeviceLayoutValues = z.infer<typeof usageSidebarDeviceLayout.schema>;

export const EXTENDED_SOURCE_IDS = {
  deepseek: "deepseek",
  opencodeGo: "opencode-go",
  opencode: "opencode",
  antigravity: "antigravity",
  pi: "pi",
} as const;

export function providerVisibilityId(providerId: string): string {
  return `provider:${providerId}`;
}

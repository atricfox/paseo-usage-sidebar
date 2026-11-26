import {
  defineTranslations,
  useSettings,
  useTranslation,
} from "@getpaseo/plugin/client";
import { useCallback } from "react";
import {
  usageSidebarDeviceLayout,
  type PluginLanguagePreference,
} from "../shared/settings";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

export const messages = defineTranslations({
  resources: {
    en,
    "zh-CN": zhCN,
  },
});

type AppTranslate = ReturnType<typeof useTranslation<typeof en>>["t"];

export function isZhLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

export function resolveSystemLocale(): "en" | "zh-CN" {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) {
      return isZhLocale(resolved) ? "zh-CN" : "en";
    }
  } catch {
    // Fall back below when Intl locale resolution is unavailable.
  }
  try {
    const navLang = (globalThis as { navigator?: { language?: string } }).navigator?.language;
    if (navLang && isZhLocale(navLang)) {
      return "zh-CN";
    }
  } catch {
    // Fall back to English.
  }
  return "en";
}

function lookupTemplate(
  root: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  let current: unknown = root;
  for (const part of key.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : null;
}

function interpolateTemplate(
  template: string,
  options?: Record<string, unknown>,
): string {
  if (!options) return template;
  return template.replace(/\{\{\s*([^},\s]+)\s*\}\}/g, (_match, rawName: string) => {
    const value = options[rawName];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function usePluginI18n() {
  const { t: hostT, locale: appLocale } = useTranslation(messages);
  const layoutSettings = useSettings(usageSidebarDeviceLayout);

  const language: PluginLanguagePreference =
    layoutSettings.status === "ready" ? layoutSettings.values.language : "app";

  const effectiveLocale =
    language === "app"
      ? appLocale
      : language === "system"
        ? resolveSystemLocale()
        : language;

  const t = useCallback(
    ((key: string, options?: Record<string, unknown>) => {
      if (language === "app") {
        return options !== undefined
          ? (hostT as (k: string, opts?: Record<string, unknown>) => string)(key, options)
          : (hostT as (k: string) => string)(key);
      }
      const primaryTree = isZhLocale(effectiveLocale) ? zhCN : en;
      const template = lookupTemplate(primaryTree, key) ?? lookupTemplate(en, key) ?? key;
      return interpolateTemplate(template, options);
    }) as AppTranslate,
    [effectiveLocale, hostT, language],
  );

  const setLanguage = useCallback(
    async (next: PluginLanguagePreference): Promise<boolean> => {
      if (layoutSettings.status !== "ready") return false;
      return layoutSettings.save(
        {
          ...layoutSettings.values,
          language: next,
        },
        layoutSettings.revision,
      );
    },
    [layoutSettings],
  );

  return {
    t,
    locale: effectiveLocale,
    language,
    setLanguage,
    languageSaving: layoutSettings.saving,
    languageSaveError: layoutSettings.saveError,
    languageReady: layoutSettings.status === "ready",
  };
}

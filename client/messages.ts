import { defineTranslations } from "@getpaseo/plugin/client";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

export const messages = defineTranslations({
  resources: {
    en,
    "zh-CN": zhCN,
  },
});

export function isZhLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

import type { PluginPaseoApi } from "@getpaseo/plugin/client";
import type { PluginTheme } from "@getpaseo/plugin";
import type { DeepSeekBalanceInfo } from "../shared/deepseek";

export type ProviderUsageListData = Awaited<
  ReturnType<PluginPaseoApi["providers"]["listUsage"]>
>;
export type ProviderUsageItem = ProviderUsageListData["providers"][number];
export type ProviderUsageWindow = ProviderUsageItem["windows"][number];
export type ProviderUsageBalance = NonNullable<ProviderUsageItem["balances"]>[number];
export type ProviderUsageDetail = NonNullable<ProviderUsageItem["details"]>[number];
export type UsageTone = ProviderUsageWindow["tone"];

export function resolveRemainingPct(usageWindow: ProviderUsageWindow): number | null {
  if (typeof usageWindow.remainingPct === "number" && Number.isFinite(usageWindow.remainingPct)) {
    return clampPercent(usageWindow.remainingPct);
  }
  if (typeof usageWindow.usedPct === "number" && Number.isFinite(usageWindow.usedPct)) {
    return clampPercent(100 - usageWindow.usedPct);
  }
  return null;
}

export function resolveUsedPct(usageWindow: ProviderUsageWindow): number | null {
  if (typeof usageWindow.usedPct === "number" && Number.isFinite(usageWindow.usedPct)) {
    return clampPercent(usageWindow.usedPct);
  }
  if (typeof usageWindow.remainingPct === "number" && Number.isFinite(usageWindow.remainingPct)) {
    return clampPercent(100 - usageWindow.remainingPct);
  }
  return null;
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function formatPercent(pct: number): string {
  const clamped = clampPercent(pct);
  if (clamped > 0 && clamped < 10 && Math.abs(clamped - Math.round(clamped)) >= 0.05) {
    return `${clamped.toFixed(1)}%`;
  }
  return `${Math.round(clamped)}%`;
}

export function toneToColor(
  tone: UsageTone,
  theme: PluginTheme,
  fallbackRemainingPct?: number | null,
): string {
  if (tone === "danger") return theme.colors.statusDanger;
  if (tone === "warning") return theme.colors.statusWarning;
  if (tone === "ok") return theme.colors.statusSuccess;
  if (typeof fallbackRemainingPct === "number") {
    if (fallbackRemainingPct <= 10) return theme.colors.statusDanger;
    if (fallbackRemainingPct <= 25) return theme.colors.statusWarning;
    return theme.colors.statusSuccess;
  }
  return theme.colors.foreground;
}

export function pickPrimaryWindow(windows: readonly ProviderUsageWindow[]): ProviderUsageWindow | null {
  if (windows.length === 0) return null;
  const summaryWindows = windows.filter((item) => item.summary === true);
  const candidates = summaryWindows.length > 0 ? summaryWindows : windows;

  let chosen = candidates[0] ?? null;
  let chosenRemaining = chosen ? resolveRemainingPct(chosen) : null;

  for (const candidate of candidates.slice(1)) {
    const candidateRemaining = resolveRemainingPct(candidate);
    if (
      candidateRemaining !== null &&
      (chosenRemaining === null || candidateRemaining < chosenRemaining)
    ) {
      chosen = candidate;
      chosenRemaining = candidateRemaining;
    }
  }
  return chosen;
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, "");
}

export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  if (value >= 100) return `$${Math.round(value)}`;
  if (value >= 10) return `$${value.toFixed(1)}`;
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}

export function formatDetailedNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatBalanceCompact(balance: ProviderUsageBalance): string {
  const value = balance.remaining ?? balance.used ?? null;
  if (value === null || !Number.isFinite(value)) return "--";
  switch (balance.unit) {
    case "usd":
      return `$${value >= 100 ? formatCompactNumber(value) : value.toFixed(2)}`;
    case "credits":
      return `${formatCompactNumber(value)} cr`;
    case "requests":
      return `${formatCompactNumber(value)} req`;
    case "tokens":
      return `${formatCompactNumber(value)} tok`;
  }
}

export function formatBalanceDetailed(
  balance: ProviderUsageBalance,
  locale = "en",
): string {
  const zh = locale.toLowerCase().startsWith("zh");
  const remaining = balance.remaining;
  const limit = balance.limit;
  const used = balance.used;

  const formatWithUnit = (amount: number): string => {
    switch (balance.unit) {
      case "usd":
        return `$${amount.toFixed(2)}`;
      case "credits":
        return `${formatDetailedNumber(amount, 2)} credits`;
      case "requests":
        return `${formatDetailedNumber(amount, 0)} requests`;
      case "tokens":
        return `${formatDetailedNumber(amount, 0)} tokens`;
    }
  };

  if (typeof remaining === "number" && Number.isFinite(remaining)) {
    if (typeof limit === "number" && Number.isFinite(limit)) {
      return `${formatWithUnit(remaining)} / ${formatWithUnit(limit)}`;
    }
    return zh ? `剩余 ${formatWithUnit(remaining)}` : `${formatWithUnit(remaining)} left`;
  }
  if (typeof used === "number" && Number.isFinite(used)) {
    if (typeof limit === "number" && Number.isFinite(limit)) {
      return zh
        ? `已用 ${formatWithUnit(used)} / ${formatWithUnit(limit)}`
        : `${formatWithUnit(used)} / ${formatWithUnit(limit)} used`;
    }
    return zh ? `已用 ${formatWithUnit(used)}` : `${formatWithUnit(used)} used`;
  }
  return "--";
}

export function formatResetCountdown(
  isoOrDate: string | null | undefined,
  nowMs: number,
  mode: "compact" | "detailed" = "compact",
  locale = "en",
): string | null {
  if (!isoOrDate) return null;
  const targetMs = Date.parse(isoOrDate);
  if (!Number.isFinite(targetMs)) return null;

  const zh = locale.toLowerCase().startsWith("zh");
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    if (mode === "compact") return zh ? "将重置" : "soon";
    return zh ? "即将重置" : "Resets soon";
  }

  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (mode === "compact") {
    if (days >= 2) return `${days}d`;
    if (days === 1) return hours > 0 ? `1d${hours}h` : "1d";
    if (hours >= 1) return minutes > 0 && hours < 10 ? `${hours}h${minutes}m` : `${hours}h`;
    return `${totalMinutes}m`;
  }

  if (zh) {
    if (days >= 1) {
      return hours > 0 ? `${days} 天 ${hours} 小时后重置` : `${days} 天后重置`;
    }
    if (hours >= 1) {
      return minutes > 0 ? `${hours} 小时 ${minutes} 分钟后重置` : `${hours} 小时后重置`;
    }
    return `${totalMinutes} 分钟后重置`;
  }

  if (days >= 1) {
    return hours > 0 ? `Resets in ${days}d ${hours}h` : `Resets in ${days}d`;
  }
  if (hours >= 1) {
    return minutes > 0 ? `Resets in ${hours}h ${minutes}m` : `Resets in ${hours}h`;
  }
  return `Resets in ${totalMinutes}m`;
}

export function formatLocalDateTime(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  // Preserve date-only strings like "2026-12-01" without shifting timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate.trim())) {
    return isoOrDate.trim();
  }
  const timestamp = Date.parse(isoOrDate);
  if (!Number.isFinite(timestamp)) return isoOrDate;
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

export function formatTimeShort(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  const timestamp = Date.parse(isoOrDate);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}

export function findResetFromDetails(details: readonly ProviderUsageDetail[] | undefined): string | null {
  if (!details || details.length === 0) return null;
  const resetDetail = details.find(
    (item) =>
      item.id.toLowerCase().includes("reset") || item.label.toLowerCase().includes("reset"),
  );
  return resetDetail?.value ?? null;
}

export function formatCurrencyAmount(currency: string, amount: string): string {
  const upper = currency.trim().toUpperCase();
  if (upper === "CNY" || upper === "RMB") return `¥${amount}`;
  if (upper === "USD") return `$${amount}`;
  return `${upper} ${amount}`;
}

export function pickPrimaryDeepSeekBalance(
  balances: readonly DeepSeekBalanceInfo[],
): DeepSeekBalanceInfo | null {
  if (balances.length === 0) return null;
  const nonZero = balances.find((item) => {
    const parsed = Number.parseFloat(item.totalBalance);
    return Number.isFinite(parsed) && parsed > 0;
  });
  return nonZero ?? balances[0] ?? null;
}

export function providerFocusKey(provider: ProviderUsageItem, index: number): string {
  return `${provider.providerId}-${index}`;
}

const KNOWN_SOURCE_LABELS: Readonly<Record<string, string>> = {
  codex: "Codex",
  claude: "Claude",
  copilot: "GitHub Copilot",
  cursor: "Cursor",
  kimi: "Kimi",
  minimax: "MiniMax",
  zai: "Z.AI",
  grok: "Grok",
  "opencode-go": "OpenCode Go",
  muse: "Muse",
};

function fallbackSourceName(providerId: string): string {
  const known = KNOWN_SOURCE_LABELS[providerId.toLowerCase()];
  if (known) return known;
  return providerId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export interface ResolvedProviderLabels {
  sourceName: string;
  accountLabel: string | null;
}

export function resolveProviderLabels(provider: ProviderUsageItem): ResolvedProviderLabels {
  const display = provider.displayName?.trim() || "";
  const explicitSource = provider.sourceLabel?.trim() || "";
  const knownSource = KNOWN_SOURCE_LABELS[provider.providerId.toLowerCase()];

  if (display.includes("@")) {
    return {
      sourceName: explicitSource || knownSource || fallbackSourceName(provider.providerId),
      accountLabel: display,
    };
  }

  if (explicitSource && display && explicitSource.toLowerCase() !== display.toLowerCase()) {
    return {
      sourceName: explicitSource,
      accountLabel: display,
    };
  }

  return {
    sourceName: display || explicitSource || fallbackSourceName(provider.providerId),
    accountLabel: null,
  };
}

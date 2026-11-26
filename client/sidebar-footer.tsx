import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow, SidebarSeparator } from "@getpaseo/plugin/client/ui";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { AntigravityGroup, AntigravityUsageResult } from "../shared/antigravity";
import {
  EXTENDED_SOURCE_IDS,
  providerVisibilityId,
} from "../shared/settings";
import {
  findResetFromDetails,
  formatBalanceCompact,
  formatCompactNumber,
  formatCurrencyAmount,
  formatPercent,
  formatResetCountdown,
  formatUsdCompact,
  pickPrimaryDeepSeekBalance,
  pickPrimaryWindow,
  providerFocusKey,
  resolveProviderLabels,
  resolveRemainingPct,
  toneToColor,
  type ProviderUsageItem,
} from "./format";
import { usePluginI18n } from "./messages";
import {
  USAGE_SCREEN_ID,
  useAntigravityUsageQuery,
  useDeepSeekBalanceQuery,
  useOpenCodeUsageQuery,
  usePiUsageQuery,
  useProviderUsageQuery,
  useSidebarCollapsed,
  useUsageVisibility,
} from "./use-usage-data";



interface CompactTrailingSummary {
  primary: string;
  primaryColor: string;
  secondary?: string;
}

function buildRowLabel(
  provider: ProviderUsageItem,
  duplicateNames: ReadonlySet<string>,
  index: number,
): string {
  const { sourceName, accountLabel } = resolveProviderLabels(provider);
  if (!duplicateNames.has(sourceName)) return sourceName;
  return `${sourceName} (${accountLabel || "#" + (index + 1)})`;
}

function shortAntigravityGroupLabel(groupName: string): string {
  const lower = groupName.toLowerCase();
  if (lower.includes("gemini")) return "AGY Gemini";
  if (lower.includes("claude") || lower.includes("gpt")) return "AGY Claude/GPT";
  return `AGY ${groupName}`;
}

export function UsageSidebarFooterItem({
  theme,
  host,
  currentScreen,
  openScreen,
}: PluginSidebarItemProps) {
  const { t, locale } = usePluginI18n();
  const visibility = useUsageVisibility(host.id);
  const sidebarLayout = useSidebarCollapsed();
  const providersQuery = useProviderUsageQuery(host.id);
  const deepSeekQuery = useDeepSeekBalanceQuery(host.id);
  const openCodeQuery = useOpenCodeUsageQuery(host.id);
  const antigravityQuery = useAntigravityUsageQuery(host.id);
  const piQuery = usePiUsageQuery(host.id);

  const styles = useMemo(
    () => ({
      trailing: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        flexShrink: 0,
      },
      primaryText: {
        fontSize: 11,
        fontWeight: "600" as const,
        fontVariant: ["tabular-nums" as const],
      },
      secondaryText: {
        fontSize: 11,
        color: theme.colors.foregroundMuted,
        fontVariant: ["tabular-nums" as const],
      },
      detailsPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: theme.colors.surface2,
      },
      detailsPillText: {
        fontSize: 11,
        color: theme.colors.foregroundMuted,
        fontWeight: "500" as const,
      },
    }),
    [theme],
  );

  const allProviders = providersQuery.data?.providers ?? [];
  const hasBuiltInOpenCodeGo = allProviders.some(
    (item) => item.providerId.toLowerCase() === "opencode-go",
  );
  const hasBuiltInClaude = allProviders.some(
    (item) => item.providerId.toLowerCase() === "claude",
  );
  const filteredProviders = useMemo(
    () =>
      allProviders.filter((item) => !visibility.isHidden(providerVisibilityId(item.providerId))),
    [allProviders, visibility],
  );

  const nowMs = Date.now();
  const isOnUsageScreen = currentScreen?.screenId === USAGE_SCREEN_ID;
  const activeFocus = isOnUsageScreen ? currentScreen?.params.focus ?? null : null;

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of filteredProviders) {
      const { sourceName } = resolveProviderLabels(item);
      counts.set(sourceName, (counts.get(sourceName) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [name, count] of counts) {
      if (count > 1) dups.add(name);
    }
    return dups;
  }, [filteredProviders]);

  const visibleProviders = filteredProviders;

  const showClaudeUnconfigured =
    !providersQuery.isPending &&
    !providersQuery.isError &&
    !hasBuiltInClaude &&
    !visibility.isHidden(providerVisibilityId("claude"));
  const showDeepSeek = !visibility.isHidden(EXTENDED_SOURCE_IDS.deepseek);
  const showOpenCodeGo =
    !hasBuiltInOpenCodeGo && !visibility.isHidden(EXTENDED_SOURCE_IDS.opencodeGo);
  const showOpenCodeLocal = !visibility.isHidden(EXTENDED_SOURCE_IDS.opencode);
  const showAntigravity = !visibility.isHidden(EXTENDED_SOURCE_IDS.antigravity);
  const showPi =
    !visibility.isHidden(EXTENDED_SOURCE_IDS.pi) &&
    (piQuery.isError ||
      piQuery.data?.status === "available" ||
      piQuery.data?.status === "error");

  const buildProviderSummary = (provider: ProviderUsageItem): CompactTrailingSummary => {
    if (provider.status === "error") {
      return { primary: t("common.error"), primaryColor: theme.colors.statusDanger };
    }
    if (provider.status === "unavailable") {
      return { primary: t("common.unavailable"), primaryColor: theme.colors.statusWarning };
    }

    const primaryWindow = pickPrimaryWindow(provider.windows ?? []);
    const primaryBalance = provider.balances?.[0] ?? null;
    const remainingPct = primaryWindow ? resolveRemainingPct(primaryWindow) : null;

    const secondaryParts: string[] = [];

    if (primaryWindow && remainingPct !== null) {
      if (primaryBalance) {
        secondaryParts.push(formatBalanceCompact(primaryBalance));
      }
      const countdown = formatResetCountdown(
        primaryWindow.resetsAt ?? findResetFromDetails(provider.details),
        nowMs,
        "compact",
        locale,
      );
      if (countdown) {
        secondaryParts.push(countdown);
      }
      return {
        primary: formatPercent(remainingPct),
        primaryColor: toneToColor(primaryWindow.tone, theme, remainingPct),
        secondary: secondaryParts.length > 0 ? secondaryParts.join(" · ") : undefined,
      };
    }

    if (primaryBalance) {
      const countdown = formatResetCountdown(
        primaryBalance.resetsAt ?? findResetFromDetails(provider.details),
        nowMs,
        "compact",
        locale,
      );
      return {
        primary: formatBalanceCompact(primaryBalance),
        primaryColor: toneToColor(primaryBalance.tone, theme),
        secondary: countdown ?? undefined,
      };
    }

    const detailReset = findResetFromDetails(provider.details);
    const countdown = formatResetCountdown(detailReset, nowMs, "compact", locale);
    if (countdown) {
      return {
        primary: countdown,
        primaryColor: theme.colors.foregroundMuted,
        secondary: provider.planLabel ?? undefined,
      };
    }

    return {
      primary: provider.planLabel ?? t("common.available"),
      primaryColor: theme.colors.foregroundMuted,
    };
  };

  const buildAntigravityGroupSummary = (group: AntigravityGroup): CompactTrailingSummary => {
    const fiveHour = group.buckets.find(
      (item) => item.window === "5h" || item.id.includes("5h"),
    );
    const weekly = group.buckets.find(
      (item) => item.window === "weekly" || item.id.includes("weekly"),
    );

    if (fiveHour && weekly) {
      const tightestPct = Math.min(fiveHour.remainingPct, weekly.remainingPct);
      const countdown = formatResetCountdown(fiveHour.resetsAt, nowMs, "compact", locale);
      return {
        primary: formatPercent(fiveHour.remainingPct),
        primaryColor: toneToColor(undefined, theme, tightestPct),
        secondary: [
          t("sidebar.wkCompact", { pct: formatPercent(weekly.remainingPct) }),
          countdown,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }

    const primary = [...group.buckets].sort((a, b) => a.remainingPct - b.remainingPct)[0];
    if (!primary) {
      return { primary: "--", primaryColor: theme.colors.foregroundMuted };
    }
    const countdown = formatResetCountdown(primary.resetsAt, nowMs, "compact", locale);
    return {
      primary: formatPercent(primary.remainingPct),
      primaryColor: toneToColor(undefined, theme, primary.remainingPct),
      secondary: countdown ?? undefined,
    };
  };

  const deepSeekSummary = useMemo((): CompactTrailingSummary => {
    if (deepSeekQuery.isPending && !deepSeekQuery.data) {
      return { primary: "...", primaryColor: theme.colors.foregroundMuted };
    }
    if (deepSeekQuery.isError) {
      return { primary: t("common.error"), primaryColor: theme.colors.statusDanger };
    }
    const result = deepSeekQuery.data;
    if (!result) {
      return { primary: "--", primaryColor: theme.colors.foregroundMuted };
    }
    if (result.status === "unconfigured") {
      return { primary: t("common.unconfigured"), primaryColor: theme.colors.foregroundMuted };
    }
    if (result.status === "error") {
      return { primary: t("common.readFailed"), primaryColor: theme.colors.statusDanger };
    }
    const primary = pickPrimaryDeepSeekBalance(result.balances);
    if (!primary) {
      return {
        primary: result.isAvailable ? t("common.available") : t("common.lowBalance"),
        primaryColor: result.isAvailable ? theme.colors.statusSuccess : theme.colors.statusDanger,
      };
    }
    return {
      primary: formatCurrencyAmount(primary.currency, primary.totalBalance),
      primaryColor: result.isAvailable ? theme.colors.statusSuccess : theme.colors.statusDanger,
    };
  }, [deepSeekQuery.data, deepSeekQuery.isError, deepSeekQuery.isPending, t, theme]);

  const openCodeGoSummary = useMemo((): CompactTrailingSummary => {
    if (openCodeQuery.isPending && !openCodeQuery.data) {
      return { primary: "...", primaryColor: theme.colors.foregroundMuted };
    }
    if (openCodeQuery.isError) {
      return { primary: t("common.error"), primaryColor: theme.colors.statusDanger };
    }
    const go = openCodeQuery.data?.go;
    if (!go) return { primary: "--", primaryColor: theme.colors.foregroundMuted };
    if (go.status === "unconfigured") {
      return { primary: t("common.notSignedIn"), primaryColor: theme.colors.foregroundMuted };
    }
    if (go.status === "error") {
      return { primary: t("common.readFailed"), primaryColor: theme.colors.statusDanger };
    }
    const sorted = [...go.windows].sort((a, b) => a.remainingPct - b.remainingPct);
    const primaryWin = sorted[0];
    if (!primaryWin) {
      return { primary: t("common.available"), primaryColor: theme.colors.statusSuccess };
    }
    const countdown = formatResetCountdown(primaryWin.resetsAt, nowMs, "compact", locale);
    return {
      primary: formatPercent(primaryWin.remainingPct),
      primaryColor: toneToColor(
        primaryWin.status === "rate-limited" ? "danger" : undefined,
        theme,
        primaryWin.remainingPct,
      ),
      secondary: [primaryWin.shortLabel, countdown].filter(Boolean).join(" · ") || undefined,
    };
  }, [locale, nowMs, openCodeQuery.data?.go, openCodeQuery.isError, openCodeQuery.isPending, t, theme]);

  const openCodeLocalSummary = useMemo((): CompactTrailingSummary => {
    if (openCodeQuery.isPending && !openCodeQuery.data) {
      return { primary: "...", primaryColor: theme.colors.foregroundMuted };
    }
    if (openCodeQuery.isError) {
      return { primary: t("common.error"), primaryColor: theme.colors.statusDanger };
    }
    const stats = openCodeQuery.data?.localStats;
    if (!stats) return { primary: "--", primaryColor: theme.colors.foregroundMuted };
    if (stats.status === "unavailable") {
      return { primary: t("common.notInstalled"), primaryColor: theme.colors.foregroundMuted };
    }
    if (stats.status === "error") {
      return { primary: t("common.readFailed"), primaryColor: theme.colors.statusDanger };
    }

    if (!visibility.showOpenCodeFreeModels) {
      const weekSpend = formatUsdCompact(stats.last7Days.costUsd);
      if (stats.today.costUsd > 0) {
        return {
          primary: t("sidebar.spentToday", { amount: formatUsdCompact(stats.today.costUsd) }),
          primaryColor: theme.colors.foreground,
          secondary: `7d ${weekSpend}`,
        };
      }
      if (stats.last7Days.costUsd > 0) {
        return {
          primary: t("sidebar.spent7d", { amount: weekSpend }),
          primaryColor: theme.colors.foreground,
          secondary: t("sidebar.todayZero"),
        };
      }
      return {
        primary: t("sidebar.paidZero"),
        primaryColor: theme.colors.foregroundMuted,
      };
    }

    const todayTokens = formatCompactNumber(stats.today.totalTokens);
    const weekCost =
      stats.last7Days.costUsd > 0
        ? t("sidebar.weekSpendCompact", { amount: formatUsdCompact(stats.last7Days.costUsd) })
        : t("sidebar.weekTokensCompact", { tokens: formatCompactNumber(stats.last7Days.totalTokens) });
    return {
      primary: t("sidebar.todayTokens", { tokens: todayTokens }),
      primaryColor: theme.colors.foreground,
      secondary: weekCost,
    };
  }, [
    openCodeQuery.data?.localStats,
    openCodeQuery.isError,
    openCodeQuery.isPending,
    t,
    theme,
    visibility.showOpenCodeFreeModels,
  ]);

  const antigravityFallbackSummary = (result?: AntigravityUsageResult): CompactTrailingSummary => {
    if (antigravityQuery.isPending && !antigravityQuery.data) {
      return { primary: "...", primaryColor: theme.colors.foregroundMuted };
    }
    if (antigravityQuery.isError) {
      return { primary: t("common.error"), primaryColor: theme.colors.statusDanger };
    }
    if (!result) return { primary: "--", primaryColor: theme.colors.foregroundMuted };
    if (result.status === "unavailable") {
      return { primary: t("common.notInstalled"), primaryColor: theme.colors.foregroundMuted };
    }
    if (result.status === "error") {
      return { primary: t("common.readFailed"), primaryColor: theme.colors.statusDanger };
    }
    return { primary: t("common.available"), primaryColor: theme.colors.statusSuccess };
  };

  const piSummary = useMemo((): CompactTrailingSummary => {
    if (piQuery.isPending && !piQuery.data) {
      return { primary: "...", primaryColor: theme.colors.foregroundMuted };
    }
    if (piQuery.isError) {
      return { primary: t("common.error"), primaryColor: theme.colors.statusDanger };
    }
    const result = piQuery.data;
    if (!result) return { primary: "--", primaryColor: theme.colors.foregroundMuted };
    if (result.status === "not_found") {
      return { primary: t("common.notConfigured"), primaryColor: theme.colors.foregroundMuted };
    }
    if (result.status === "error") {
      return { primary: t("common.readFailed"), primaryColor: theme.colors.statusDanger };
    }
    if (result.openRouter?.status === "available") {
      return {
        primary: formatUsdCompact(result.openRouter.remainingUsd),
        primaryColor:
          result.openRouter.remainingUsd > 0
            ? theme.colors.statusSuccess
            : theme.colors.statusDanger,
        secondary: "OpenRouter",
      };
    }
    if (result.openRouter?.status === "error") {
      return {
        primary: t("common.readFailed"),
        primaryColor: theme.colors.statusDanger,
        secondary: "OpenRouter",
      };
    }
    return {
      primary: t("pi.providersCount", { count: result.providers.length }),
      primaryColor:
        result.providers.length > 0 ? theme.colors.foreground : theme.colors.foregroundMuted,
    };
  }, [piQuery.data, piQuery.isError, piQuery.isPending, t, theme]);

  const accounts = antigravityQuery.data ?? [{ id: "antigravity", label: "Antigravity", quota: undefined }];

  if (visibility.loading || sidebarLayout.loading) {
    return null;
  }

  if (sidebarLayout.collapsed) {
    return (
      <>
        <SidebarSeparator />
        <SidebarRow
          id="toggle-collapse"
          icon="Eye"
          label={t("sidebar.showQuotas")}
          active={isOnUsageScreen}
          onPress={() => void sidebarLayout.toggleCollapsed()}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("meta.commandOpenUsage")}
              onPress={() => openScreen({ screenId: USAGE_SCREEN_ID })}
              style={styles.detailsPill}
            >
              <Text style={styles.detailsPillText}>{t("sidebar.details")}</Text>
            </Pressable>
          }
        />
      </>
    );
  }

  const renderTrailing = (summary: CompactTrailingSummary) => (
    <View style={styles.trailing}>
      <Text style={[styles.primaryText, { color: summary.primaryColor }]} numberOfLines={1}>
        {summary.primary}
      </Text>
      {summary.secondary ? (
        <Text style={styles.secondaryText} numberOfLines={1}>
          {summary.secondary}
        </Text>
      ) : null}
    </View>
  );

  const hasAnyVisibleRow =
    visibleProviders.length > 0 ||
    showClaudeUnconfigured ||
    showDeepSeek ||
    showOpenCodeGo ||
    showOpenCodeLocal ||
    showAntigravity ||
    showPi ||
    (providersQuery.isPending && allProviders.length === 0) ||
    (providersQuery.isError && allProviders.length === 0);

  return (
    <>
      <SidebarSeparator />
      {providersQuery.isPending && allProviders.length === 0 ? (
        <SidebarRow
          id="providers-loading"
          icon="Gauge"
          label={t("sidebar.accountQuotas")}
          active={isOnUsageScreen && !activeFocus}
          onPress={() => openScreen({ screenId: USAGE_SCREEN_ID })}
          trailing={renderTrailing({
            primary: t("common.loading"),
            primaryColor: theme.colors.foregroundMuted,
          })}
        />
      ) : providersQuery.isError && allProviders.length === 0 ? (
        <SidebarRow
          id="providers-error"
          icon="Gauge"
          label={t("sidebar.accountQuotas")}
          active={isOnUsageScreen && !activeFocus}
          onPress={() => openScreen({ screenId: USAGE_SCREEN_ID })}
          trailing={renderTrailing({
            primary: t("common.readFailed"),
            primaryColor: theme.colors.statusDanger,
          })}
        />
      ) : (
        visibleProviders.map((provider, index) => {
          const focusKey = providerFocusKey(provider, index);
          const summary = buildProviderSummary(provider);
          return (
            <SidebarRow
              key={focusKey}
              id={`provider-${provider.providerId}-${index}`}
              icon="Gauge"
              label={buildRowLabel(provider, duplicateNames, index)}
              active={isOnUsageScreen && activeFocus === focusKey}
              onPress={() => openScreen({ screenId: USAGE_SCREEN_ID, params: { focus: focusKey } })}
              trailing={renderTrailing(summary)}
            />
          );
        })
      )}

      {showClaudeUnconfigured ? (
        <SidebarRow
          id="provider-claude-unconfigured"
          icon="Gauge"
          label={t("claude.title")}
          active={isOnUsageScreen && activeFocus === "claude-unconfigured"}
          onPress={() =>
            openScreen({
              screenId: USAGE_SCREEN_ID,
              params: { focus: "claude-unconfigured" },
            })
          }
          trailing={renderTrailing({
            primary: t("common.unconfigured"),
            primaryColor: theme.colors.foregroundMuted,
          })}
        />
      ) : null}

      {showDeepSeek ? (
        <SidebarRow
          id="deepseek-balance"
          icon="Wallet"
          label="DeepSeek"
          active={isOnUsageScreen && activeFocus === EXTENDED_SOURCE_IDS.deepseek}
          onPress={() =>
            openScreen({
              screenId: USAGE_SCREEN_ID,
              params: { focus: EXTENDED_SOURCE_IDS.deepseek },
            })
          }
          trailing={renderTrailing(deepSeekSummary)}
        />
      ) : null}

      {showOpenCodeGo ? (
        <SidebarRow
          id="opencode-go-quota"
          icon="Zap"
          label="OpenCode Go"
          active={isOnUsageScreen && activeFocus === EXTENDED_SOURCE_IDS.opencodeGo}
          onPress={() =>
            openScreen({
              screenId: USAGE_SCREEN_ID,
              params: { focus: EXTENDED_SOURCE_IDS.opencodeGo },
            })
          }
          trailing={renderTrailing(openCodeGoSummary)}
        />
      ) : null}

      {showOpenCodeLocal ? (
        <SidebarRow
          id="opencode-local-stats"
          icon="Activity"
          label="OpenCode"
          active={isOnUsageScreen && activeFocus === EXTENDED_SOURCE_IDS.opencode}
          onPress={() =>
            openScreen({
              screenId: USAGE_SCREEN_ID,
              params: { focus: EXTENDED_SOURCE_IDS.opencode },
            })
          }
          trailing={renderTrailing(openCodeLocalSummary)}
        />
      ) : null}

      {showAntigravity && accounts.map(({ id, label, quota }) => {
        const groups = quota?.status === "available" ? quota.groups : [];
        const focus = { screenId: USAGE_SCREEN_ID, params: { focus: id } };
        if (!groups.length) return (
          <SidebarRow key={id} id={id} icon="Cpu" label={label}
            active={isOnUsageScreen && activeFocus === id} onPress={() => openScreen(focus)}
            trailing={renderTrailing(antigravityFallbackSummary(quota))} />
        );
        return groups.map((group) => (
          <SidebarRow key={id + group.name} id={id + "-" + group.name} icon="Cpu"
            label={shortAntigravityGroupLabel(group.name).replace("AGY ", label.replace(/^Antigravity/i, "AGY") + " ")}
            active={isOnUsageScreen && activeFocus === id} onPress={() => openScreen(focus)}
            trailing={renderTrailing(buildAntigravityGroupSummary(group))} />
        ));
      })}

      {showPi ? (
        <SidebarRow
          id="pi-usage"
          icon="Terminal"
          label="Pi"
          active={isOnUsageScreen && activeFocus === EXTENDED_SOURCE_IDS.pi}
          onPress={() =>
            openScreen({
              screenId: USAGE_SCREEN_ID,
              params: { focus: EXTENDED_SOURCE_IDS.pi },
            })
          }
          trailing={renderTrailing(piSummary)}
        />
      ) : null}

      {!hasAnyVisibleRow ? (
        <SidebarRow
          id="all-hidden-entry"
          icon="EyeOff"
          label={t("sidebar.allHiddenEntry")}
          active={isOnUsageScreen}
          onPress={() => openScreen({ screenId: USAGE_SCREEN_ID })}
          trailing={renderTrailing({
            primary: t("common.hidden"),
            primaryColor: theme.colors.foregroundMuted,
          })}
        />
      ) : null}

      <SidebarRow
        id="toggle-collapse"
        icon="EyeOff"
        label={t("sidebar.hideQuotas")}
        onPress={() => void sidebarLayout.toggleCollapsed()}
      />
    </>
  );
}

import {
  useTranslation,
  type PluginScreenProps,
} from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { AntigravityErrorCode } from "../shared/antigravity";
import type { DeepSeekBalanceResult, DeepSeekErrorCode } from "../shared/deepseek";
import type {
  OpenCodeGoErrorCode,
  OpenCodeGoStatus,
  OpenCodeLocalErrorCode,
  OpenCodeLocalStats,
} from "../shared/opencode";
import {
  EXTENDED_SOURCE_IDS,
  providerVisibilityId,
} from "../shared/settings";
import {
  formatBalanceDetailed,
  formatCompactNumber,
  formatCurrencyAmount,
  formatLocalDateTime,
  formatPercent,
  formatResetCountdown,
  formatTimeShort,
  formatUsdCompact,
  providerFocusKey,
  resolveProviderLabels,
  resolveRemainingPct,
  resolveUsedPct,
  toneToColor,
  type ProviderUsageItem,
} from "./format";
import { messages } from "./messages";
import {
  useAgentUsageSummaryQuery,
  useAntigravityUsageQuery,
  useDeepSeekBalanceQuery,
  useOpenCodeUsageQuery,
  useProviderUsageQuery,
  useUsageVisibility,
} from "./use-usage-data";

export function UsageDetailsScreen({ theme, host, layout, params }: PluginScreenProps) {
  const { t, locale } = useTranslation(messages);
  const visibility = useUsageVisibility(host.id);
  const providersQuery = useProviderUsageQuery(host.id);
  const deepSeekQuery = useDeepSeekBalanceQuery(host.id);
  const openCodeQuery = useOpenCodeUsageQuery(host.id);
  const antigravityQuery = useAntigravityUsageQuery(host.id);
  const agentsQuery = useAgentUsageSummaryQuery(host.id);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try {
      await Promise.allSettled([
        providersQuery.refetch(),
        deepSeekQuery.refetch(),
        openCodeQuery.refetch(),
        antigravityQuery.forceRefresh(),
        agentsQuery.refetch(),
      ]);
    } finally {
      setManualRefreshing(false);
    }
  }, [
    agentsQuery,
    antigravityQuery,
    deepSeekQuery,
    manualRefreshing,
    openCodeQuery,
    providersQuery,
  ]);

  const isRefreshing =
    manualRefreshing ||
    providersQuery.isFetching ||
    deepSeekQuery.isFetching ||
    openCodeQuery.isFetching ||
    antigravityQuery.isFetching ||
    agentsQuery.isFetching;

  const styles = useMemo(
    () => ({
      root: {
        flex: 1,
        backgroundColor: theme.colors.surface0,
      },
      content: {
        padding: layout.compact ? 14 : 24,
        gap: layout.compact ? 12 : 16,
      },
      headerRow: {
        flexDirection: layout.compact ? ("column" as const) : ("row" as const),
        alignItems: layout.compact ? ("stretch" as const) : ("center" as const),
        justifyContent: "space-between" as const,
        gap: 12,
      },
      headerMeta: {
        gap: 4,
        flexShrink: 1,
      },
      title: {
        color: theme.colors.foreground,
        fontSize: layout.compact ? 18 : 22,
        fontWeight: "600" as const,
      },
      subtitle: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
      },
      refreshButton: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: theme.colors.accent,
        alignSelf: layout.compact ? ("flex-start" as const) : ("center" as const),
      },
      refreshButtonPressed: {
        opacity: 0.85,
      },
      refreshButtonText: {
        color: theme.colors.accentForeground,
        fontSize: 13,
        fontWeight: "600" as const,
      },
      sectionTitle: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        fontWeight: "600" as const,
        letterSpacing: 0.3,
        marginTop: 4,
      },
      card: {
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: layout.compact ? 12 : 16,
        gap: 12,
      },
      cardFocused: {
        borderColor: theme.colors.accent,
      },
      cardHeader: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 8,
        flexWrap: "wrap" as const,
      },
      cardTitleGroup: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        flexShrink: 1,
        flexWrap: "wrap" as const,
      },
      cardHeaderActions: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
      },
      cardTitle: {
        color: theme.colors.foreground,
        fontSize: 15,
        fontWeight: "600" as const,
      },
      pill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: theme.colors.surface2,
      },
      pillText: {
        color: theme.colors.foregroundMuted,
        fontSize: 11,
        fontWeight: "500" as const,
      },
      hideButton: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: theme.colors.surface2,
      },
      hideButtonText: {
        color: theme.colors.foregroundMuted,
        fontSize: 11,
        fontWeight: "500" as const,
      },
      statusText: {
        fontSize: 12,
        fontWeight: "600" as const,
      },
      metaRow: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        gap: 12,
      },
      metaText: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
      },
      blockGroup: {
        gap: 8,
      },
      blockHeader: {
        color: theme.colors.foregroundMuted,
        fontSize: 11,
        fontWeight: "600" as const,
      },
      windowItem: {
        backgroundColor: theme.colors.surface2,
        borderRadius: 8,
        padding: 10,
        gap: 6,
      },
      windowTopRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 8,
      },
      windowLabel: {
        color: theme.colors.foreground,
        fontSize: 13,
        fontWeight: "500" as const,
      },
      windowPct: {
        fontSize: 13,
        fontWeight: "600" as const,
        fontVariant: ["tabular-nums" as const],
      },
      barTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.surface0,
        overflow: "hidden" as const,
      },
      barFill: {
        height: 6,
        borderRadius: 3,
      },
      windowMetaRow: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        justifyContent: "space-between" as const,
        gap: 6,
      },
      kvRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 12,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      },
      kvLabel: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        flexShrink: 1,
      },
      kvValue: {
        color: theme.colors.foreground,
        fontSize: 13,
        fontWeight: "500" as const,
        fontVariant: ["tabular-nums" as const],
      },
      balanceRow: {
        backgroundColor: theme.colors.surface2,
        borderRadius: 8,
        padding: 10,
        gap: 4,
      },
      balancePrimary: {
        color: theme.colors.foreground,
        fontSize: 16,
        fontWeight: "600" as const,
        fontVariant: ["tabular-nums" as const],
      },
      statsGrid: {
        flexDirection: layout.compact ? ("column" as const) : ("row" as const),
        gap: 8,
      },
      statBox: {
        flex: 1,
        backgroundColor: theme.colors.surface2,
        borderRadius: 8,
        padding: 10,
        gap: 4,
      },
      statBoxTitle: {
        color: theme.colors.foregroundMuted,
        fontSize: 11,
        fontWeight: "600" as const,
      },
      statBoxValue: {
        color: theme.colors.foreground,
        fontSize: 15,
        fontWeight: "600" as const,
        fontVariant: ["tabular-nums" as const],
      },
      errorText: {
        color: theme.colors.statusDanger,
        fontSize: 13,
      },
      warningText: {
        color: theme.colors.statusWarning,
        fontSize: 13,
      },
      guideBox: {
        backgroundColor: theme.colors.surface2,
        borderRadius: 8,
        padding: 12,
        gap: 6,
      },
      guideTitle: {
        color: theme.colors.foreground,
        fontSize: 13,
        fontWeight: "600" as const,
      },
      guideLine: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        lineHeight: 18,
      },
      codeBlock: {
        backgroundColor: theme.colors.surface0,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
      codeText: {
        color: theme.colors.foreground,
        fontSize: 12,
      },
      hiddenBar: {
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 10,
      },
      chipWrap: {
        flexDirection: "row" as const,
        flexWrap: "wrap" as const,
        gap: 8,
      },
      restoreChip: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: theme.colors.surface2,
      },
      restoreChipText: {
        color: theme.colors.foreground,
        fontSize: 12,
      },
      footnote: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        lineHeight: 18,
        paddingTop: 4,
      },
    }),
    [theme, layout.compact],
  );

  const statusMeta = (status: ProviderUsageItem["status"]) => {
    switch (status) {
      case "available":
        return { label: t("common.available"), color: theme.colors.statusSuccess };
      case "unavailable":
        return { label: t("common.unavailable"), color: theme.colors.statusWarning };
      case "error":
        return { label: t("common.error"), color: theme.colors.statusDanger };
    }
  };

  const deepSeekSourceLabel = (source: "env" | "config" | "opencode" | undefined): string | null => {
    switch (source) {
      case "env":
        return t("sources.env");
      case "config":
        return t("sources.config");
      case "opencode":
        return t("sources.opencode");
      default:
        return null;
    }
  };

  const openCodeGoSourceLabel = (
    source: "env" | "config" | "opencode-v1" | "opencode-v2" | undefined,
  ): string | null => {
    switch (source) {
      case "env":
        return t("sources.env");
      case "config":
        return t("sources.config");
      case "opencode-v1":
        return t("sources.opencodeV1");
      case "opencode-v2":
        return t("sources.opencodeV2");
      default:
        return null;
    }
  };

  const formatDeepSeekError = (
    code: DeepSeekErrorCode,
    httpStatus?: number,
    configPath?: string,
  ): string => {
    const path = configPath ?? "~/.paseo/usage-sidebar.json";
    switch (code) {
      case "config_read_failed":
        return t("deepseek.errConfigRead", { path });
      case "config_invalid_json":
        return t("deepseek.errConfigJson", { path });
      case "config_invalid_schema":
        return t("deepseek.errConfigSchema", { path });
      case "auth_failed":
        return t("deepseek.errAuth", { status: httpStatus ?? 401 });
      case "rate_limited":
        return t("deepseek.errRateLimited");
      case "http_error":
        return t("deepseek.errHttp", { status: httpStatus ?? 500 });
      case "invalid_json":
        return t("deepseek.errInvalidJson");
      case "unexpected_schema":
        return t("deepseek.errUnexpectedSchema");
      case "timeout":
        return t("deepseek.errTimeout");
      case "network_error":
        return t("deepseek.errNetwork");
    }
  };

  const formatOpenCodeGoError = (
    code: OpenCodeGoErrorCode,
    httpStatus?: number,
    configPath?: string,
  ): string => {
    const path = configPath ?? "~/.paseo/usage-sidebar.json";
    switch (code) {
      case "config_read_failed":
        return t("opencodeGo.errConfigRead", { path });
      case "config_invalid_json":
        return t("opencodeGo.errConfigJson", { path });
      case "config_invalid_schema":
        return t("opencodeGo.errConfigSchema", { path });
      case "auth_failed":
        return t("opencodeGo.errAuth", { status: httpStatus ?? 401 });
      case "http_error":
        return t("opencodeGo.errHttp", { status: httpStatus ?? 500 });
      case "unexpected_schema":
        return t("opencodeGo.errUnexpectedSchema");
      case "timeout":
        return t("opencodeGo.errTimeout");
      case "network_error":
        return t("opencodeGo.errNetwork");
    }
  };

  const formatOpenCodeLocalError = (code: OpenCodeLocalErrorCode): string => {
    switch (code) {
      case "cli_not_found":
        return t("opencodeLocal.errCliNotFound");
      case "parse_failed":
        return t("opencodeLocal.errParseFailed");
      case "exec_failed":
        return t("opencodeLocal.errExecFailed");
    }
  };

  const formatAntigravityError = (code: AntigravityErrorCode): string => {
    switch (code) {
      case "cli_not_found":
        return t("antigravity.errCliNotFound");
      case "status_error":
        return t("antigravity.errStatus");
      case "timeout":
        return t("antigravity.errTimeout");
      case "exec_failed":
        return t("antigravity.errExec");
    }
  };

  const nowMs = Date.now();
  const focusParam = params.focus ?? null;
  const allProviders = providersQuery.data?.providers ?? [];
  const hasBuiltInOpenCodeGo = allProviders.some(
    (item) => item.providerId.toLowerCase() === "opencode-go",
  );
  const visibleProviders = allProviders.filter(
    (item) => !visibility.isHidden(providerVisibilityId(item.providerId)),
  );

  const lastFetchedText = formatTimeShort(
    providersQuery.data?.fetchedAt ??
      deepSeekQuery.data?.fetchedAt ??
      openCodeQuery.data?.fetchedAt ??
      antigravityQuery.data?.fetchedAt,
  );

  const renderHideButton = (visibilityId: string, displayName: string) =>
    visibility.ready ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("screen.hideA11y", { name: displayName })}
        disabled={visibility.saving}
        onPress={() => void visibility.setHidden(visibilityId, true)}
        style={styles.hideButton}
      >
        <Icon name="EyeOff" size={12} color={theme.colors.foregroundMuted} />
        <Text style={styles.hideButtonText}>{t("common.hide")}</Text>
      </Pressable>
    ) : null;

  const hiddenItemLabels = useMemo(() => {
    const labelMap = new Map<string, string>([
      [EXTENDED_SOURCE_IDS.deepseek, t("deepseek.title")],
      [EXTENDED_SOURCE_IDS.opencodeGo, t("opencodeGo.title")],
      [EXTENDED_SOURCE_IDS.opencode, t("opencodeLocal.title")],
      [EXTENDED_SOURCE_IDS.antigravity, t("antigravity.title")],
    ]);
    for (const item of allProviders) {
      const { sourceName } = resolveProviderLabels(item);
      labelMap.set(providerVisibilityId(item.providerId), sourceName);
    }
    return visibility.hiddenIds.map((id) => ({
      id,
      label:
        labelMap.get(id) ??
        (id.startsWith("provider:") ? id.slice("provider:".length) : id),
    }));
  }, [allProviders, t, visibility.hiddenIds]);

  const renderDeepSeekCard = (result: DeepSeekBalanceResult | undefined) => {
    if (visibility.isHidden(EXTENDED_SOURCE_IDS.deepseek)) return null;
    const isFocused = focusParam === EXTENDED_SOURCE_IDS.deepseek;
    const sourceBadge =
      result?.status === "available"
        ? deepSeekSourceLabel(result.source)
        : result?.status === "unconfigured"
          ? t("sources.noKey")
          : result?.status === "error"
            ? deepSeekSourceLabel(result.source)
            : null;

    const statusBadge =
      deepSeekQuery.isPending && !result
        ? { label: t("common.loading"), color: theme.colors.foregroundMuted }
        : deepSeekQuery.isError
          ? { label: t("common.requestFailed"), color: theme.colors.statusDanger }
          : result?.status === "available"
            ? result.isAvailable
              ? { label: t("common.available"), color: theme.colors.statusSuccess }
              : { label: t("common.lowBalance"), color: theme.colors.statusDanger }
            : result?.status === "unconfigured"
              ? { label: t("common.unconfigured"), color: theme.colors.statusWarning }
              : { label: t("common.error"), color: theme.colors.statusDanger };

    const dshAgents = agentsQuery.data?.byProvider.dsh;

    return (
      <View style={[styles.card, isFocused ? styles.cardFocused : null]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <Icon name="Wallet" size={16} color={theme.colors.foreground} />
            <Text style={styles.cardTitle}>{t("deepseek.title")}</Text>
            {sourceBadge ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{sourceBadge}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardHeaderActions}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
            {renderHideButton(EXTENDED_SOURCE_IDS.deepseek, t("deepseek.title"))}
          </View>
        </View>

        {result?.fetchedAt ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {t("screen.fetchedMeta", {
                time: formatLocalDateTime(result.fetchedAt) ?? "",
              })}
            </Text>
          </View>
        ) : null}

        {deepSeekQuery.isError ? (
          <Text style={styles.errorText}>
            {t("deepseek.rpcFailed", {
              error:
                deepSeekQuery.error instanceof Error
                  ? deepSeekQuery.error.message
                  : String(deepSeekQuery.error),
            })}
          </Text>
        ) : result?.status === "available" ? (
          <View style={styles.blockGroup}>
            {result.balances.length === 0 ? (
              <Text style={styles.metaText}>{t("deepseek.noBreakdown")}</Text>
            ) : (
              result.balances.map((item) => (
                <View key={item.currency} style={styles.balanceRow}>
                  <View style={styles.windowTopRow}>
                    <Text style={styles.windowLabel}>
                      {t("deepseek.totalBalance", { currency: item.currency })}
                    </Text>
                    <Text
                      style={[
                        styles.balancePrimary,
                        {
                          color: result.isAvailable
                            ? theme.colors.statusSuccess
                            : theme.colors.statusDanger,
                        },
                      ]}
                    >
                      {formatCurrencyAmount(item.currency, item.totalBalance)}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {t("deepseek.toppedUp", {
                        amount: formatCurrencyAmount(item.currency, item.toppedUpBalance),
                      })}
                    </Text>
                    <Text style={styles.metaText}>
                      {t("deepseek.granted", {
                        amount: formatCurrencyAmount(item.currency, item.grantedBalance),
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}
            <Text style={styles.metaText}>{t("deepseek.platformNote")}</Text>
          </View>
        ) : result?.status === "unconfigured" ? (
          <View style={styles.guideBox}>
            <Text style={styles.guideTitle}>{t("deepseek.unconfiguredTitle")}</Text>
            <Text style={styles.guideLine}>{t("deepseek.unconfiguredIntro")}</Text>
            <Text style={styles.guideLine}>{t("deepseek.unconfiguredStep1")}</Text>
            <Text style={styles.guideLine}>
              {t("deepseek.unconfiguredStep2", { path: result.configPath })}
            </Text>
            <View style={styles.codeBlock}>
              <Text selectable style={styles.codeText}>
                {'{ "deepseekApiKey": "sk-your-key" }'}
              </Text>
            </View>
            <Text style={styles.guideLine}>{t("deepseek.unconfiguredStep3")}</Text>
          </View>
        ) : result?.status === "error" ? (
          <Text style={styles.errorText}>
            {formatDeepSeekError(result.code, result.httpStatus, result.configPath)}
          </Text>
        ) : null}

        {dshAgents && dshAgents.totalTokens > 0 ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>{t("deepseek.dshObserved")}</Text>
            <Text style={styles.kvValue}>
              {formatCompactNumber(dshAgents.totalTokens)} tokens
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderOpenCodeGoCard = (go: OpenCodeGoStatus | undefined) => {
    if (hasBuiltInOpenCodeGo || visibility.isHidden(EXTENDED_SOURCE_IDS.opencodeGo)) {
      return null;
    }
    const isFocused = focusParam === EXTENDED_SOURCE_IDS.opencodeGo;
    const sourceBadge =
      go?.status === "available"
        ? openCodeGoSourceLabel(go.source)
        : go?.status === "error"
          ? openCodeGoSourceLabel(go.source)
          : go?.status === "unconfigured"
            ? t("sources.notLoggedIn")
            : null;
    const statusBadge =
      openCodeQuery.isPending && !go
        ? { label: t("common.loading"), color: theme.colors.foregroundMuted }
        : openCodeQuery.isError
          ? { label: t("common.requestFailed"), color: theme.colors.statusDanger }
          : go?.status === "available"
            ? { label: t("common.available"), color: theme.colors.statusSuccess }
            : go?.status === "unconfigured"
              ? { label: t("common.unconfigured"), color: theme.colors.statusWarning }
              : { label: t("common.error"), color: theme.colors.statusDanger };

    return (
      <View style={[styles.card, isFocused ? styles.cardFocused : null]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <Icon name="Zap" size={16} color={theme.colors.foreground} />
            <Text style={styles.cardTitle}>{t("opencodeGo.title")}</Text>
            {sourceBadge ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{sourceBadge}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardHeaderActions}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
            {renderHideButton(EXTENDED_SOURCE_IDS.opencodeGo, t("opencodeGo.title"))}
          </View>
        </View>

        {go?.status === "available" ? (
          <View style={styles.blockGroup}>
            <Text style={styles.blockHeader}>{t("opencodeGo.windowsHeader")}</Text>
            {go.windows.map((win) => {
              const fillColor = toneToColor(
                win.status === "rate-limited" ? "danger" : undefined,
                theme,
                win.remainingPct,
              );
              const countdown = formatResetCountdown(win.resetsAt, nowMs, "detailed", locale);
              const resetAt = formatLocalDateTime(win.resetsAt);
              return (
                <View key={win.id} style={styles.windowItem}>
                  <View style={styles.windowTopRow}>
                    <Text style={styles.windowLabel}>{win.label}</Text>
                    <Text style={[styles.windowPct, { color: fillColor }]}>
                      {t("screen.remainingPct", { pct: formatPercent(win.remainingPct) })}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${win.remainingPct}%`, backgroundColor: fillColor },
                      ]}
                    />
                  </View>
                  <View style={styles.windowMetaRow}>
                    <Text style={styles.metaText}>
                      {t("screen.usedPct", { pct: formatPercent(win.usedPct) })}
                      {win.status === "rate-limited" ? t("opencodeGo.rateLimitedTag") : ""}
                    </Text>
                    {countdown || resetAt ? (
                      <Text style={styles.metaText}>
                        {[countdown, resetAt ? `(${resetAt})` : null]
                          .filter(Boolean)
                          .join(" ")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : go?.status === "unconfigured" ? (
          <View style={styles.guideBox}>
            <Text style={styles.guideTitle}>{t("opencodeGo.unconfiguredTitle")}</Text>
            <Text style={styles.guideLine}>{t("opencodeGo.unconfiguredIntro")}</Text>
            <Text style={styles.guideLine}>
              {t("opencodeGo.unconfiguredStep1", { path: go.configPath })}
            </Text>
            <Text style={styles.guideLine}>{t("opencodeGo.unconfiguredStep2")}</Text>
            <Text style={styles.guideLine}>{t("opencodeGo.unconfiguredStep3")}</Text>
          </View>
        ) : go?.status === "error" ? (
          <Text style={styles.errorText}>
            {formatOpenCodeGoError(go.code, go.httpStatus, go.configPath)}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderOpenCodeLocalCard = (stats: OpenCodeLocalStats | undefined) => {
    if (visibility.isHidden(EXTENDED_SOURCE_IDS.opencode)) return null;
    const isFocused = focusParam === EXTENDED_SOURCE_IDS.opencode;
    const showFree = visibility.showOpenCodeFreeModels;
    const statusBadge =
      openCodeQuery.isPending && !stats
        ? { label: t("common.loading"), color: theme.colors.foregroundMuted }
        : openCodeQuery.isError
          ? { label: t("common.requestFailed"), color: theme.colors.statusDanger }
          : stats?.status === "available"
            ? {
                label: showFree
                  ? t("opencodeLocal.badgeWithFree")
                  : t("opencodeLocal.badgePaidOnly"),
                color: theme.colors.statusSuccess,
              }
            : stats?.status === "unavailable"
              ? { label: t("common.notInstalled"), color: theme.colors.statusWarning }
              : { label: t("common.error"), color: theme.colors.statusDanger };

    const visibleModels =
      stats?.status === "available"
        ? stats.last7Days.models.filter((item) => showFree || !item.isFree)
        : [];
    const hiddenFreeCount =
      stats?.status === "available" && !showFree ? stats.last7Days.freeModelCount : 0;

    return (
      <View style={[styles.card, isFocused ? styles.cardFocused : null]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <Icon name="Activity" size={16} color={theme.colors.foreground} />
            <Text style={styles.cardTitle}>{t("opencodeLocal.title")}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>opencode stats</Text>
            </View>
          </View>
          <View style={styles.cardHeaderActions}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
            {visibility.ready ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showFree ? t("opencodeLocal.hideFreeA11y") : t("opencodeLocal.showFreeA11y")
                }
                disabled={visibility.saving}
                onPress={() => void visibility.setShowOpenCodeFreeModels(!showFree)}
                style={styles.hideButton}
              >
                <Icon
                  name={showFree ? "EyeOff" : "Eye"}
                  size={12}
                  color={theme.colors.foregroundMuted}
                />
                <Text style={styles.hideButtonText}>
                  {showFree ? t("opencodeLocal.hideFree") : t("opencodeLocal.showFree")}
                </Text>
              </Pressable>
            ) : null}
            {renderHideButton(EXTENDED_SOURCE_IDS.opencode, t("opencodeLocal.title"))}
          </View>
        </View>

        {stats?.status === "available" ? (
          <>
            {stats.integrations.length > 0 ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {t("opencodeLocal.integrations", { list: stats.integrations.join(" / ") })}
                </Text>
              </View>
            ) : null}

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxTitle}>
                  {showFree
                    ? t("opencodeLocal.todayWithFreeTitle")
                    : t("opencodeLocal.todayPaidTitle")}
                </Text>
                <Text style={styles.statBoxValue}>
                  {showFree
                    ? `${formatCompactNumber(stats.today.totalTokens)} tokens`
                    : t("sidebar.spentToday", { amount: formatUsdCompact(stats.today.costUsd) })}
                </Text>
                <Text style={styles.metaText}>
                  {showFree
                    ? t("opencodeLocal.periodMetaWithFree", {
                        sessions: stats.today.sessions,
                        prompts: stats.today.prompts,
                        cost: formatUsdCompact(stats.today.costUsd),
                      })
                    : t("opencodeLocal.periodMetaPaid", {
                        tokens: formatCompactNumber(stats.today.paidTokens),
                        steps: stats.today.paidSteps,
                      })}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxTitle}>
                  {showFree
                    ? t("opencodeLocal.weekWithFreeTitle")
                    : t("opencodeLocal.weekPaidTitle")}
                </Text>
                <Text style={styles.statBoxValue}>
                  {showFree
                    ? `${formatCompactNumber(stats.last7Days.totalTokens)} tokens`
                    : t("sidebar.spentToday", {
                        amount: formatUsdCompact(stats.last7Days.costUsd),
                      })}
                </Text>
                <Text style={styles.metaText}>
                  {showFree
                    ? t("opencodeLocal.periodMetaWithFree", {
                        sessions: stats.last7Days.sessions,
                        prompts: stats.last7Days.prompts,
                        cost: formatUsdCompact(stats.last7Days.costUsd),
                      })
                    : t("opencodeLocal.periodMetaPaid", {
                        tokens: formatCompactNumber(stats.last7Days.paidTokens),
                        steps: stats.last7Days.paidSteps,
                      })}
                </Text>
              </View>
            </View>

            {visibleModels.length > 0 ? (
              <View style={styles.blockGroup}>
                <Text style={styles.blockHeader}>
                  {showFree
                    ? t("opencodeLocal.modelsHeaderWithFree")
                    : t("opencodeLocal.modelsHeaderPaid")}
                </Text>
                {visibleModels.map((model) => (
                  <View
                    key={`${model.providerId}/${model.id}/${model.variant ?? ""}`}
                    style={styles.kvRow}
                  >
                    <Text style={styles.kvLabel}>
                      {model.providerId}/{model.id}
                      {model.variant ? ` (${model.variant})` : ""}
                    </Text>
                    <Text style={styles.kvValue}>
                      {model.isFree
                        ? t("opencodeLocal.modelFreeValue", {
                            tokens: formatCompactNumber(model.totalTokens),
                          })
                        : t("opencodeLocal.modelSpentValue", {
                            cost: formatUsdCompact(model.costUsd),
                            tokens: formatCompactNumber(model.totalTokens),
                          })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.metaText}>{t("opencodeLocal.noPaidModels")}</Text>
            )}

            {hiddenFreeCount > 0 ? (
              <Text style={styles.metaText}>
                {t("opencodeLocal.hiddenFreeSummary", {
                  count: hiddenFreeCount,
                  tokens: formatCompactNumber(stats.last7Days.freeTokens),
                })}
              </Text>
            ) : null}

            <Text style={styles.metaText}>{t("opencodeLocal.spendNote")}</Text>
          </>
        ) : stats?.status === "unavailable" ? (
          <Text style={styles.warningText}>{formatOpenCodeLocalError(stats.code)}</Text>
        ) : stats?.status === "error" ? (
          <Text style={styles.errorText}>{formatOpenCodeLocalError(stats.code)}</Text>
        ) : null}
      </View>
    );
  };

  const renderAntigravityCard = () => {
    if (visibility.isHidden(EXTENDED_SOURCE_IDS.antigravity)) return null;
    const isFocused = focusParam === EXTENDED_SOURCE_IDS.antigravity;
    const quota = antigravityQuery.data;
    const agyAgents = agentsQuery.data?.byProvider.antigravity;

    const statusBadge =
      antigravityQuery.isPending && !quota
        ? { label: t("common.checking"), color: theme.colors.foregroundMuted }
        : antigravityQuery.isError
          ? { label: t("common.requestFailed"), color: theme.colors.statusDanger }
          : quota?.status === "available"
            ? { label: t("common.available"), color: theme.colors.statusSuccess }
            : quota?.status === "unavailable"
              ? { label: t("common.notInstalled"), color: theme.colors.statusWarning }
              : { label: t("common.error"), color: theme.colors.statusDanger };

    return (
      <View style={[styles.card, isFocused ? styles.cardFocused : null]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <Icon name="Cpu" size={16} color={theme.colors.foreground} />
            <Text style={styles.cardTitle}>{t("antigravity.title")}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>agy /usage & /credits</Text>
            </View>
            {quota?.status === "available" && quota.remainingCredits !== null ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {t("antigravity.creditsPill", { count: quota.remainingCredits })}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardHeaderActions}>
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
            {renderHideButton(EXTENDED_SOURCE_IDS.antigravity, t("antigravity.title"))}
          </View>
        </View>

        {quota?.fetchedAt ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {t("screen.fetchedMeta", {
                time: formatLocalDateTime(quota.fetchedAt) ?? "",
              })}
            </Text>
            {quota.status === "available" ? (
              <Text style={styles.metaText}>
                {t("antigravity.cacheMeta", { seconds: quota.cacheTtlSeconds })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {antigravityQuery.isPending && !quota ? (
          <Text style={styles.metaText}>{t("antigravity.loading")}</Text>
        ) : antigravityQuery.isError ? (
          <Text style={styles.errorText}>
            {t("antigravity.rpcFailed", {
              error:
                antigravityQuery.error instanceof Error
                  ? antigravityQuery.error.message
                  : String(antigravityQuery.error),
            })}
          </Text>
        ) : quota?.status === "available" ? (
          <View style={styles.blockGroup}>
            {quota.groups.map((group) => (
              <View key={group.name} style={styles.blockGroup}>
                <Text style={styles.blockHeader}>{group.name}</Text>
                {group.description ? (
                  <Text style={styles.metaText}>{group.description}</Text>
                ) : null}
                {group.buckets.map((bucket) => {
                  const fillColor = toneToColor(undefined, theme, bucket.remainingPct);
                  const countdown = formatResetCountdown(
                    bucket.resetsAt,
                    nowMs,
                    "detailed",
                    locale,
                  );
                  const resetAt = formatLocalDateTime(bucket.resetsAt);
                  return (
                    <View key={bucket.id} style={styles.windowItem}>
                      <View style={styles.windowTopRow}>
                        <Text style={styles.windowLabel}>{bucket.name}</Text>
                        <Text style={[styles.windowPct, { color: fillColor }]}>
                          {t("screen.remainingPct", { pct: formatPercent(bucket.remainingPct) })}
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${bucket.remainingPct}%`, backgroundColor: fillColor },
                          ]}
                        />
                      </View>
                      <View style={styles.windowMetaRow}>
                        <Text style={styles.metaText}>
                          {t("screen.usedPct", { pct: formatPercent(bucket.usedPct) })}
                        </Text>
                        {countdown || resetAt ? (
                          <Text style={styles.metaText}>
                            {[countdown, resetAt ? `(${resetAt})` : null]
                              .filter(Boolean)
                              .join(" ")}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : quota?.status === "unavailable" ? (
          <Text style={styles.warningText}>{formatAntigravityError(quota.code)}</Text>
        ) : quota?.status === "error" ? (
          <Text style={styles.errorText}>{formatAntigravityError(quota.code)}</Text>
        ) : null}

        {agyAgents && agyAgents.totalObservedAgents > 0 ? (
          <View style={styles.blockGroup}>
            <Text style={styles.blockHeader}>{t("antigravity.sessionsHeader")}</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>
                {t("antigravity.sessionsSummary", {
                  running: agyAgents.runningCount,
                  idle: agyAgents.idleCount,
                })}
              </Text>
              <Text style={styles.kvValue}>
                {formatCompactNumber(agyAgents.totalTokens)} tok
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <Text style={styles.title}>{t("screen.title")}</Text>
          <Text style={styles.subtitle}>
            {lastFetchedText
              ? t("screen.subtitleUpdated", { host: host.label, time: lastFetchedText })
              : t("screen.subtitle", { host: host.label })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("screen.refreshA11y")}
          disabled={isRefreshing}
          onPress={() => void handleRefresh()}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed || isRefreshing ? styles.refreshButtonPressed : null,
          ]}
        >
          <Icon name="RefreshCw" size={14} color={theme.colors.accentForeground} />
          <Text style={styles.refreshButtonText}>
            {isRefreshing ? t("screen.refreshing") : t("screen.refresh")}
          </Text>
        </Pressable>
      </View>

      {visibility.saveError ? (
        <Text style={styles.errorText}>
          {t("screen.saveError", { error: visibility.saveError })}
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>{t("screen.sectionBuiltin")}</Text>

      {providersQuery.isPending && allProviders.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.metaText}>{t("screen.loadingProviders")}</Text>
        </View>
      ) : providersQuery.isError ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {t("screen.providerError", {
              error:
                providersQuery.error instanceof Error
                  ? providersQuery.error.message
                  : String(providersQuery.error),
            })}
          </Text>
        </View>
      ) : visibleProviders.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.metaText}>
            {allProviders.length > 0
              ? t("screen.allBuiltinHidden")
              : t("screen.noBuiltinProviders")}
          </Text>
        </View>
      ) : (
        visibleProviders.map((provider, index) => {
          const key = providerFocusKey(provider, index);
          const isFocused = focusParam === key;
          const badge = statusMeta(provider.status);
          const { sourceName, accountLabel } = resolveProviderLabels(provider);
          const visId = providerVisibilityId(provider.providerId);
          const windows = provider.windows ?? [];
          const balances = provider.balances ?? [];
          const details = provider.details ?? [];

          return (
            <View key={key} style={[styles.card, isFocused ? styles.cardFocused : null]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleGroup}>
                  <Icon name="Gauge" size={16} color={theme.colors.foreground} />
                  <Text style={styles.cardTitle}>{sourceName}</Text>
                  {provider.planLabel ? (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{provider.planLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardHeaderActions}>
                  <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                  {renderHideButton(visId, sourceName)}
                </View>
              </View>

              <View style={styles.metaRow}>
                {accountLabel ? (
                  <Text style={styles.metaText}>
                    {t("screen.accountMeta", { account: accountLabel })}
                  </Text>
                ) : null}
                <Text style={styles.metaText}>
                  {t("screen.sourceIdMeta", { id: provider.providerId })}
                </Text>
                {provider.fetchedAt ? (
                  <Text style={styles.metaText}>
                    {t("screen.fetchedMeta", {
                      time: formatLocalDateTime(provider.fetchedAt) ?? "",
                    })}
                  </Text>
                ) : null}
                {provider.nextRefreshAt ? (
                  <Text style={styles.metaText}>
                    {t("screen.nextRefreshMeta", {
                      time: formatLocalDateTime(provider.nextRefreshAt) ?? "",
                    })}
                  </Text>
                ) : null}
              </View>

              {provider.error ? (
                <Text
                  style={
                    provider.status === "unavailable" ? styles.warningText : styles.errorText
                  }
                >
                  {provider.error}
                </Text>
              ) : null}

              {windows.length > 0 ? (
                <View style={styles.blockGroup}>
                  <Text style={styles.blockHeader}>{t("screen.quotaWindows")}</Text>
                  {windows.map((win) => {
                    const remainingPct = resolveRemainingPct(win);
                    const usedPct = resolveUsedPct(win);
                    const fillColor = toneToColor(win.tone, theme, remainingPct);
                    const countdown = formatResetCountdown(win.resetsAt, nowMs, "detailed", locale);
                    const resetAt = formatLocalDateTime(win.resetsAt);
                    return (
                      <View key={win.id} style={styles.windowItem}>
                        <View style={styles.windowTopRow}>
                          <Text style={styles.windowLabel}>{win.label}</Text>
                          <Text style={[styles.windowPct, { color: fillColor }]}>
                            {remainingPct !== null
                              ? t("screen.remainingPct", { pct: formatPercent(remainingPct) })
                              : "--"}
                          </Text>
                        </View>
                        {remainingPct !== null ? (
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${remainingPct}%`,
                                  backgroundColor: fillColor,
                                },
                              ]}
                            />
                          </View>
                        ) : null}
                        <View style={styles.windowMetaRow}>
                          {usedPct !== null ? (
                            <Text style={styles.metaText}>
                              {t("screen.usedPct", { pct: formatPercent(usedPct) })}
                            </Text>
                          ) : null}
                          {countdown || resetAt ? (
                            <Text style={styles.metaText}>
                              {[countdown, resetAt ? `(${resetAt})` : null]
                                .filter(Boolean)
                                .join(" ")}
                            </Text>
                          ) : null}
                        </View>
                        {win.runsOutAt ? (
                          <Text style={styles.warningText}>
                            {t("screen.runsOutAt", {
                              time: formatLocalDateTime(win.runsOutAt) ?? "",
                            })}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {balances.length > 0 ? (
                <View style={styles.blockGroup}>
                  <Text style={styles.blockHeader}>{t("screen.balances")}</Text>
                  {balances.map((balance) => {
                    const balanceColor = toneToColor(balance.tone, theme);
                    const resetCountdown = formatResetCountdown(
                      balance.resetsAt,
                      nowMs,
                      "detailed",
                      locale,
                    );
                    return (
                      <View key={balance.id} style={styles.balanceRow}>
                        <View style={styles.windowTopRow}>
                          <Text style={styles.windowLabel}>{balance.label}</Text>
                          <Text style={[styles.windowPct, { color: balanceColor }]}>
                            {formatBalanceDetailed(balance, locale)}
                          </Text>
                        </View>
                        {resetCountdown ? (
                          <Text style={styles.metaText}>
                            {resetCountdown} ({formatLocalDateTime(balance.resetsAt)})
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {details.length > 0 ? (
                <View style={styles.blockGroup}>
                  <Text style={styles.blockHeader}>{t("screen.details")}</Text>
                  {details.map((detail) => (
                    <View key={detail.id} style={styles.kvRow}>
                      <Text style={styles.kvLabel}>{detail.label}</Text>
                      <Text
                        style={[
                          styles.kvValue,
                          detail.tone
                            ? { color: toneToColor(detail.tone, theme) }
                            : null,
                        ]}
                      >
                        {detail.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>{t("screen.sectionExtended")}</Text>
      {renderDeepSeekCard(deepSeekQuery.data)}
      {renderOpenCodeGoCard(openCodeQuery.data?.go)}
      {renderOpenCodeLocalCard(openCodeQuery.data?.localStats)}
      {renderAntigravityCard()}

      {hiddenItemLabels.length > 0 ? (
        <View style={styles.hiddenBar}>
          <View style={styles.cardHeader}>
            <Text style={styles.blockHeader}>
              {t("screen.hiddenBarTitle", { count: hiddenItemLabels.length })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("screen.restoreAllA11y")}
              disabled={visibility.saving}
              onPress={() => void visibility.reset()}
              style={styles.hideButton}
            >
              <Text style={styles.hideButtonText}>{t("common.restoreAll")}</Text>
            </Pressable>
          </View>
          <View style={styles.chipWrap}>
            {hiddenItemLabels.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={t("screen.restoreItemA11y", { name: item.label })}
                disabled={visibility.saving}
                onPress={() => void visibility.setHidden(item.id, false)}
                style={styles.restoreChip}
              >
                <Icon name="Eye" size={12} color={theme.colors.foreground} />
                <Text style={styles.restoreChipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.footnote}>{t("screen.footnote")}</Text>
    </ScrollView>
  );
}

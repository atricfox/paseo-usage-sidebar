import {
  useTranslation,
  type PluginSurfaceProps,
} from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useMemo } from "react";
import { Text, View } from "react-native";
import {
  EXTENDED_SOURCE_IDS,
  providerVisibilityId,
} from "../shared/settings";
import { resolveProviderLabels } from "./format";
import { messages } from "./messages";
import {
  useProviderUsageQuery,
  useUsageVisibility,
} from "./use-usage-data";

export function UsageSettingsScreen({ theme, host }: PluginSurfaceProps) {
  const { t } = useTranslation(messages);
  const visibility = useUsageVisibility(host.id);
  const providersQuery = useProviderUsageQuery(host.id);

  const styles = useMemo(
    () => ({
      container: {
        gap: 16,
      },
      muted: {
        color: theme.colors.foregroundMuted,
        fontSize: 13,
      },
      error: {
        color: theme.colors.statusDanger,
        fontSize: 13,
      },
    }),
    [theme],
  );

  const extendedItems = useMemo(
    () => [
      {
        id: EXTENDED_SOURCE_IDS.deepseek,
        label: t("settings.extDeepSeekLabel"),
        hint: t("settings.extDeepSeekHint"),
      },
      {
        id: EXTENDED_SOURCE_IDS.opencodeGo,
        label: t("settings.extOpenCodeGoLabel"),
        hint: t("settings.extOpenCodeGoHint"),
      },
      {
        id: EXTENDED_SOURCE_IDS.opencode,
        label: t("settings.extOpenCodeLabel"),
        hint: t("settings.extOpenCodeHint"),
      },
      {
        id: EXTENDED_SOURCE_IDS.antigravity,
        label: t("settings.extAntigravityLabel"),
        hint: t("settings.extAntigravityHint"),
      },
    ],
    [t],
  );

  const builtInItems = useMemo(() => {
    const map = new Map<string, { id: string; label: string; hint: string }>();
    for (const provider of providersQuery.data?.providers ?? []) {
      const id = providerVisibilityId(provider.providerId);
      if (map.has(id)) continue;
      const { sourceName, accountLabel } = resolveProviderLabels(provider);
      map.set(id, {
        id,
        label: sourceName,
        hint: accountLabel
          ? t("settings.builtinHintWithAccount", {
              id: provider.providerId,
              account: accountLabel,
            })
          : t("settings.builtinHint", { id: provider.providerId }),
      });
    }
    for (const hiddenId of visibility.hiddenIds) {
      if (hiddenId.startsWith("provider:") && !map.has(hiddenId)) {
        const rawId = hiddenId.slice("provider:".length);
        map.set(hiddenId, {
          id: hiddenId,
          label: rawId,
          hint: t("settings.hiddenBuiltinHint", { id: rawId }),
        });
      }
    }
    return [...map.values()];
  }, [providersQuery.data?.providers, t, visibility.hiddenIds]);

  if (visibility.loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>{t("settings.loading")}</Text>
      </View>
    );
  }

  if (visibility.settings.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>
          {t("settings.readError", { error: visibility.settings.error })}
        </Text>
      </View>
    );
  }

  if (visibility.settings.status === "invalid") {
    return (
      <View style={styles.container}>
        <SettingsSection title={t("settings.invalidSection")}>
          <SettingsCard>
            <SettingsAction
              label={t("settings.invalidLabel")}
              hint={visibility.settings.error}
              actionLabel={t("settings.resetToDefaults")}
              disabled={visibility.saving}
              onPress={() => void visibility.reset()}
            />
          </SettingsCard>
        </SettingsSection>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {visibility.saveError ? (
        <Text style={styles.error}>
          {t("settings.saveError", { error: visibility.saveError })}
        </Text>
      ) : null}

      <SettingsSection title={t("settings.sectionBuiltin")}>
        <SettingsCard>
          {builtInItems.length === 0 ? (
            <SettingsRow
              label={t("settings.noBuiltinLabel")}
              hint={t("settings.noBuiltinHint")}
            />
          ) : (
            builtInItems.map((item) => (
              <SettingsSwitch
                key={item.id}
                label={item.label}
                hint={item.hint}
                disabled={visibility.saving}
                value={!visibility.isHidden(item.id)}
                onValueChange={(visible) => void visibility.setHidden(item.id, !visible)}
              />
            ))
          )}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t("settings.sectionExtended")}>
        <SettingsCard>
          {extendedItems.map((item) => (
            <SettingsSwitch
              key={item.id}
              label={item.label}
              hint={item.hint}
              disabled={visibility.saving}
              value={!visibility.isHidden(item.id)}
              onValueChange={(visible) => void visibility.setHidden(item.id, !visible)}
            />
          ))}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t("settings.sectionOptions")}>
        <SettingsCard>
          <SettingsSwitch
            label={t("settings.showFreeLabel")}
            hint={t("settings.showFreeHint")}
            disabled={visibility.saving}
            value={visibility.showOpenCodeFreeModels}
            onValueChange={(next) => void visibility.setShowOpenCodeFreeModels(next)}
          />
          <SettingsSwitch
            label={t("settings.reuseOpenCodeCredsLabel")}
            hint={t("settings.reuseOpenCodeCredsHint")}
            disabled={visibility.saving}
            value={visibility.reuseOpenCodeCredentials}
            onValueChange={(next) => void visibility.setReuseOpenCodeCredentials(next)}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t("settings.sectionReset")}>
        <SettingsCard>
          <SettingsAction
            label={t("settings.resetAllLabel")}
            hint={t("settings.resetAllHint")}
            actionLabel={t("common.resetSettings")}
            disabled={visibility.saving}
            onPress={() => void visibility.reset()}
          />
        </SettingsCard>
      </SettingsSection>
    </View>
  );
}

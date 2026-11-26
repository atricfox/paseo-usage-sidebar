import type { PluginClientContext } from "@getpaseo/plugin/client";
import { messages } from "./client/messages";
import { UsageSettingsScreen } from "./client/settings-screen";
import { UsageSidebarFooterItem } from "./client/sidebar-footer";
import { USAGE_SCREEN_ID, USAGE_SETTINGS_ID } from "./client/use-usage-data";
import { UsageDetailsScreen } from "./client/usage-screen";

export default function contribute(client: PluginClientContext) {
  client.addScreen({
    id: USAGE_SCREEN_ID,
    title: messages.message("meta.screenTitle"),
    Component: UsageDetailsScreen,
  });

  client.addSettingsScreen({
    id: USAGE_SETTINGS_ID,
    title: messages.message("meta.settingsTitle"),
    icon: "Eye",
    Component: UsageSettingsScreen,
  });

  client.addSidebarFooterItem({
    id: "usage-summary",
    title: messages.message("meta.sidebarTitle"),
    Component: UsageSidebarFooterItem,
  });

  client.addCommandCenterItem({
    id: "open-usage-details",
    title: messages.message("meta.commandOpenUsage"),
    icon: "Gauge",
    keywords: [
      "usage",
      "quota",
      "balance",
      "deepseek",
      "codex",
      "copilot",
      "opencode",
      "antigravity",
      "配额",
      "余额",
    ],
    context: "global",
    onSelect({ openScreen }) {
      openScreen({ screenId: USAGE_SCREEN_ID });
    },
  });

  client.addCommandCenterItem({
    id: "open-usage-settings",
    title: messages.message("meta.commandOpenSettings"),
    icon: "Eye",
    keywords: ["usage", "hide", "copilot", "settings", "配额", "隐藏"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings(USAGE_SETTINGS_ID);
    },
  });

  return () => {};
}

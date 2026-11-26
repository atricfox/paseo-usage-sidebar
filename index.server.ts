import type { PluginServerContext } from "@getpaseo/plugin/server";
import { getAntigravityUsage } from "./server/antigravity";
import { createDeepSeekBalanceHandler } from "./server/deepseek";
import { createOpenCodeUsageHandler } from "./server/opencode";
import { antigravityUsageRpc } from "./shared/antigravity";
import { deepSeekBalanceRpc } from "./shared/deepseek";
import { openCodeUsageRpc } from "./shared/opencode";
import { usageSidebarSettings } from "./shared/settings";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(usageSidebarSettings);
  server.handle(deepSeekBalanceRpc, createDeepSeekBalanceHandler(settings));
  server.handle(openCodeUsageRpc, createOpenCodeUsageHandler(settings));
  server.handle(antigravityUsageRpc, getAntigravityUsage);
  return () => {};
}

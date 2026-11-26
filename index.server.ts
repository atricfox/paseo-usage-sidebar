import type { PluginServerContext } from "@getpaseo/plugin/server";
import { getAccountUsage, getAntigravityUsage } from "./server/antigravity";
import { createDeepSeekBalanceHandler } from "./server/deepseek";
import { createOpenCodeUsageHandler } from "./server/opencode";
import { createPiUsageHandler } from "./server/pi";
import { accountUsageRpc, antigravityUsageRpc } from "./shared/antigravity";
import { deepSeekBalanceRpc } from "./shared/deepseek";
import { openCodeUsageRpc } from "./shared/opencode";
import { piUsageRpc } from "./shared/pi";
import { usageSidebarSettings } from "./shared/settings";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(usageSidebarSettings);
  server.handle(deepSeekBalanceRpc, createDeepSeekBalanceHandler(settings));
  server.handle(openCodeUsageRpc, createOpenCodeUsageHandler(settings));
  server.handle(accountUsageRpc, getAccountUsage);
  server.handle(antigravityUsageRpc, getAntigravityUsage);
  server.handle(piUsageRpc, createPiUsageHandler(settings));
  return () => {};
}

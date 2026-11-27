import { findSvgIconProblem, type PluginSvgIcon } from "@getpaseo/plugin";
import {
  usePaseo,
  useRpc,
  useSettings,
  type PluginPaseoApi,
} from "@getpaseo/plugin/client";
import type { SidebarIcon } from "@getpaseo/plugin/client/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { accountUsageRpc } from "../shared/antigravity";
import { deepSeekBalanceRpc } from "../shared/deepseek";
import { openCodeUsageRpc } from "../shared/opencode";
import { piUsageRpc } from "../shared/pi";
import {
  usageSidebarDeviceLayout,
  usageSidebarSettings,
} from "../shared/settings";
import { findBundledProviderIcon } from "./provider-icons";

export const USAGE_POLL_INTERVAL_MS = 60_000;
export const ANTIGRAVITY_POLL_INTERVAL_MS = 120_000;
export const USAGE_SCREEN_ID = "usage-details";
export const USAGE_SETTINGS_ID = "display";

export type AgentListEntry = Awaited<
  ReturnType<PluginPaseoApi["agents"]["list"]>
>["entries"][number];

export interface ProviderAgentUsageSummary {
  provider: string;
  runningCount: number;
  idleCount: number;
  totalObservedAgents: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  models: Array<{
    model: string;
    agentCount: number;
    totalTokens: number;
  }>;
}

export function useProviderUsageQuery(hostId: string) {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["usage-sidebar", "providers", hostId],
    queryFn: () => paseo.providers.listUsage(),
    refetchInterval: USAGE_POLL_INTERVAL_MS,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useHostProviderIcons(hostId: string) {
  const paseo = usePaseo();
  const query = useQuery({
    queryKey: ["usage-sidebar", "provider-icons", hostId],
    queryFn: async () => {
      const snapshot = await paseo.providers.snapshot();
      const map: Record<string, PluginSvgIcon> = {};
      for (const entry of snapshot.entries ?? []) {
        const svg = entry.iconSvg?.trim();
        if (!svg || findSvgIconProblem(svg) !== null) continue;
        map[entry.provider.toLowerCase()] = { svg };
      }
      return map;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const resolveIcon = useCallback(
    (candidateIds: readonly string[], fallback: string): SidebarIcon => {
      const icons = query.data;
      if (icons) {
        for (const id of candidateIds) {
          const hit = icons[id.toLowerCase()];
          if (hit) return hit;
        }
      }
      const bundled = findBundledProviderIcon(candidateIds);
      if (bundled) return bundled;
      return fallback;
    },
    [query.data],
  );

  return { resolveIcon };
}

export function useDeepSeekBalanceQuery(hostId: string) {
  const fetchDeepSeekBalance = useRpc(deepSeekBalanceRpc);
  return useQuery({
    queryKey: ["usage-sidebar", "deepseek", hostId],
    queryFn: () => fetchDeepSeekBalance({}),
    refetchInterval: USAGE_POLL_INTERVAL_MS,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useOpenCodeUsageQuery(hostId: string) {
  const fetchOpenCodeUsage = useRpc(openCodeUsageRpc);
  return useQuery({
    queryKey: ["usage-sidebar", "opencode", hostId],
    queryFn: () => fetchOpenCodeUsage({}),
    refetchInterval: USAGE_POLL_INTERVAL_MS,
    staleTime: 30_000,
    retry: 1,
  });
}

export function usePiUsageQuery(hostId: string) {
  const fetchPiUsage = useRpc(piUsageRpc);
  return useQuery({
    queryKey: ["usage-sidebar", "pi", hostId],
    queryFn: () => fetchPiUsage({}),
    refetchInterval: USAGE_POLL_INTERVAL_MS,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAntigravityUsageQuery(hostId: string) {
  const fetchAntigravityUsage = useRpc(accountUsageRpc);
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["usage-sidebar", "antigravity-accounts", hostId] as const,
    [hostId],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAntigravityUsage({}),
    refetchInterval: ANTIGRAVITY_POLL_INTERVAL_MS,
    staleTime: 60_000,
    retry: 1,
  });

  const forceRefresh = useCallback(async () => {
    const fresh = await fetchAntigravityUsage({ forceRefresh: true });
    queryClient.setQueryData(queryKey, fresh);
    return fresh;
  }, [fetchAntigravityUsage, queryClient, queryKey]);

  return {
    ...query,
    forceRefresh,
  };
}

function summarizeAgentsByProvider(
  entries: readonly AgentListEntry[],
): Record<string, ProviderAgentUsageSummary> {
  const byProvider = new Map<
    string,
    {
      runningCount: number;
      idleCount: number;
      totalObservedAgents: number;
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      totalTokens: number;
      totalCostUsd: number;
      models: Map<string, { agentCount: number; totalTokens: number }>;
    }
  >();

  for (const entry of entries) {
    const agent = entry.agent;
    const provider = agent.provider;
    let bucket = byProvider.get(provider);
    if (!bucket) {
      bucket = {
        runningCount: 0,
        idleCount: 0,
        totalObservedAgents: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        models: new Map(),
      };
      byProvider.set(provider, bucket);
    }

    if (agent.status === "running" || agent.status === "initializing") {
      bucket.runningCount += 1;
    } else if (agent.status === "idle") {
      bucket.idleCount += 1;
    }

    const usage = agent.lastUsage;
    if (usage) {
      const input = usage.inputTokens ?? 0;
      const output = usage.outputTokens ?? 0;
      const cached = usage.cachedInputTokens ?? 0;
      const total = input + output + cached;
      bucket.totalObservedAgents += 1;
      bucket.inputTokens += input;
      bucket.outputTokens += output;
      bucket.cachedInputTokens += cached;
      bucket.totalTokens += total;
      if (typeof usage.totalCostUsd === "number" && Number.isFinite(usage.totalCostUsd)) {
        bucket.totalCostUsd += usage.totalCostUsd;
      }

      const modelName = agent.model || "default";
      const existing = bucket.models.get(modelName) ?? { agentCount: 0, totalTokens: 0 };
      existing.agentCount += 1;
      existing.totalTokens += total;
      bucket.models.set(modelName, existing);
    }
  }

  const out: Record<string, ProviderAgentUsageSummary> = {};
  for (const [provider, bucket] of byProvider) {
    out[provider] = {
      provider,
      runningCount: bucket.runningCount,
      idleCount: bucket.idleCount,
      totalObservedAgents: bucket.totalObservedAgents,
      inputTokens: bucket.inputTokens,
      outputTokens: bucket.outputTokens,
      cachedInputTokens: bucket.cachedInputTokens,
      totalTokens: bucket.totalTokens,
      totalCostUsd: bucket.totalCostUsd,
      models: [...bucket.models.entries()]
        .map(([model, info]) => ({
          model,
          agentCount: info.agentCount,
          totalTokens: info.totalTokens,
        }))
        .sort((left, right) => right.totalTokens - left.totalTokens)
        .slice(0, 6),
    };
  }
  return out;
}

export function useAgentUsageSummaryQuery(hostId: string) {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["usage-sidebar", "agent-usage", hostId],
    queryFn: async () => {
      const result = await paseo.agents.list();
      return {
        fetchedAt: new Date().toISOString(),
        byProvider: summarizeAgentsByProvider(result.entries),
      };
    },
    refetchInterval: USAGE_POLL_INTERVAL_MS,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useUsageVisibility(hostId: string) {
  const settings = useSettings(usageSidebarSettings);
  const queryClient = useQueryClient();

  const hiddenList = settings.status === "ready" ? settings.values.hiddenIds : [];
  const reuseOpenCodeCredentials =
    settings.status === "ready" ? settings.values.reuseOpenCodeCredentials : false;
  const reusePiCredentials =
    settings.status === "ready" ? settings.values.reusePiCredentials : false;
  const showOpenCodeFreeModels =
    settings.status === "ready" ? settings.values.showOpenCodeFreeModels : false;

  const hiddenSet = useMemo(() => new Set(hiddenList), [hiddenList]);

  const isHidden = useCallback((id: string) => hiddenSet.has(id), [hiddenSet]);

  const setHidden = useCallback(
    async (id: string, hidden: boolean): Promise<boolean> => {
      if (settings.status !== "ready") return false;
      const next = new Set(settings.values.hiddenIds);
      if (hidden) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return settings.save(
        {
          ...settings.values,
          hiddenIds: [...next],
        },
        settings.revision,
      );
    },
    [settings],
  );

  const setReuseOpenCodeCredentials = useCallback(
    async (value: boolean): Promise<boolean> => {
      if (settings.status !== "ready") return false;
      const ok = await settings.save(
        {
          ...settings.values,
          reuseOpenCodeCredentials: value,
        },
        settings.revision,
      );
      if (ok) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["usage-sidebar", "deepseek", hostId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["usage-sidebar", "opencode", hostId],
          }),
        ]);
      }
      return ok;
    },
    [hostId, queryClient, settings],
  );

  const setReusePiCredentials = useCallback(
    async (value: boolean): Promise<boolean> => {
      if (settings.status !== "ready") return false;
      const ok = await settings.save(
        {
          ...settings.values,
          reusePiCredentials: value,
        },
        settings.revision,
      );
      if (ok) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["usage-sidebar", "deepseek", hostId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["usage-sidebar", "opencode", hostId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["usage-sidebar", "pi", hostId],
          }),
        ]);
      }
      return ok;
    },
    [hostId, queryClient, settings],
  );

  const setShowOpenCodeFreeModels = useCallback(
    async (value: boolean): Promise<boolean> => {
      if (settings.status !== "ready") return false;
      return settings.save(
        {
          ...settings.values,
          showOpenCodeFreeModels: value,
        },
        settings.revision,
      );
    },
    [settings],
  );

  const reset = useCallback(async (): Promise<boolean> => {
    const ok = await settings.reset();
    if (ok) {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["usage-sidebar", "deepseek", hostId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["usage-sidebar", "opencode", hostId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["usage-sidebar", "pi", hostId],
        }),
      ]);
    }
    return ok;
  }, [hostId, queryClient, settings]);

  return {
    settings,
    loading: settings.status === "loading",
    ready: settings.status === "ready",
    saving: settings.saving,
    saveError: settings.saveError,
    hiddenIds: hiddenList,
    hiddenSet,
    reuseOpenCodeCredentials,
    reusePiCredentials,
    showOpenCodeFreeModels,
    isHidden,
    setHidden,
    setReuseOpenCodeCredentials,
    setReusePiCredentials,
    setShowOpenCodeFreeModels,
    reset,
  };
}

export function useSidebarCollapsed() {
  const layoutSettings = useSettings(usageSidebarDeviceLayout);
  const [fallbackCollapsed, setFallbackCollapsed] = useState(false);

  const collapsed =
    layoutSettings.status === "ready"
      ? layoutSettings.values.collapsed
      : fallbackCollapsed;

  const toggleCollapsed = useCallback(async () => {
    const next = !collapsed;
    setFallbackCollapsed(next);
    if (layoutSettings.status === "ready") {
      await layoutSettings.save(
        {
          ...layoutSettings.values,
          collapsed: next,
        },
        layoutSettings.revision,
      );
    }
  }, [collapsed, layoutSettings]);

  return {
    collapsed,
    loading: layoutSettings.status === "loading",
    saving: layoutSettings.saving,
    toggleCollapsed,
  };
}

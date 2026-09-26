import { useEffect, useState } from "react";

import { generationConfigApi, toPublishedGenerationConfig } from "../api/client";
import type { GenerationConfig } from "../lib/generation-config";
import { readCacheKeys, sharedReadCache } from "../lib/read-cache";
import { useGenerationConfigStore } from "../store/useGenerationConfigStore";


export async function refreshPublishedGenerationConfig(): Promise<GenerationConfig> {
  const record = await generationConfigApi.getPublished();
  const published = toPublishedGenerationConfig(record);
  useGenerationConfigStore.getState().replacePublished(published);
  return published;
}


export function usePublishedGenerationConfig() {
  const published = useGenerationConfigStore((state) => state.published);
  const hasCachedConfig = sharedReadCache.peek(readCacheKeys.publishedGenerationConfig) !== undefined;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(hasCachedConfig ? "ready" : "loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void refreshPublishedGenerationConfig()
      .then(() => {
        if (active) setStatus("ready");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setStatus(hasCachedConfig ? "ready" : "error");
        setError(reason instanceof Error ? reason.message : "已发布生成配置加载失败");
      });
    return () => { active = false; };
  }, []);

  return { publishedConfig: published, status, error };
}

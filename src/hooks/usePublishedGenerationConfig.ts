import { useEffect, useState } from "react";

import { generationConfigApi } from "../api/client";
import type { GenerationConfig } from "../lib/generation-config";
import { useGenerationConfigStore } from "../store/useGenerationConfigStore";


export async function refreshPublishedGenerationConfig(): Promise<GenerationConfig> {
  const record = await generationConfigApi.resolvePublished();
  if (!record.runtimeModules || record.runtimeModules.version !== "runtime-modules-v1"
    || !Array.isArray(record.runtimeModules.heroModules) || !Array.isArray(record.runtimeModules.suiteModules)) {
    throw new Error("生成模块配置无效，请刷新后重试");
  }
  const published = { ...record.config, version: record.configVersion };
  const runtime = { ...published, heroModules: record.runtimeModules.heroModules, suiteModules: record.runtimeModules.suiteModules };
  useGenerationConfigStore.getState().replaceRuntimePublished(published, runtime);
  return runtime;
}


export function usePublishedGenerationConfig() {
  const published = useGenerationConfigStore((state) => state.runtimePublished ?? state.published);
  const hasCachedConfig = useGenerationConfigStore.getState().runtimePublished !== null;
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
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "已发布生成配置加载失败");
      });
    return () => { active = false; };
  }, []);

  return { publishedConfig: published, status, error };
}

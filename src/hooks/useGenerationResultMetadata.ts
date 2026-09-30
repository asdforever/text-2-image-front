import { useEffect, useState } from "react";
import { heroGenerationApi, suiteApi, type ApiCanvasGenerationStep } from "../api/client";
import type { Asset } from "../api/contracts";

/** Reuse server lineage, never infer batch ownership from a filename or current form. */
export function useGenerationResultMetadata(projectId: string, assets: Asset[]) {
  const revision = assets.filter(asset => asset.type === "hero" || asset.type === "suite").map(asset => `${asset.id}:${asset.generationSnapshotId ?? ""}`).sort().join("|");
  const [record, setRecord] = useState<{ projectId: string; steps: ApiCanvasGenerationStep[] }>({ projectId, steps: [] });
  useEffect(() => {
    if (!revision) return;
    let active = true;
    void suiteApi.getWorkbench(projectId).then(async workbench => {
      const steps = [...(workbench.generationSteps ?? [])];
      if (active) setRecord({ projectId, steps });
      const known = new Set(steps.flatMap(step => step.outputAssetIds));
      const legacyIds = [...new Set(assets.filter(asset => asset.type === "hero" && !known.has(asset.id)).map(asset => asset.generationSnapshotId).filter((id): id is string => !!id))];
      const legacy = await Promise.allSettled(legacyIds.map(id => heroGenerationApi.get(projectId, id)));
      for (const result of legacy) {
        if (result.status !== "fulfilled") continue;
        const task = result.value;
        if (task.projectId !== projectId || !task.generatedAssetId) continue;
        const selection = (task.snapshot.selection ?? {}) as Record<string, unknown>;
        const module = selection.module as { label?: string } | undefined;
        steps.push({ creationMode: task.snapshot.creationMode === "regular" ? "regular" : "professional", id: `hero-task:${task.id}`, kind: "hero", title: module?.label ?? "主图",
          sourceAssetIds: [task.sourceAssetId], outputAssetIds: [task.generatedAssetId], outputVersionIds: [],
          finalPrompt: task.finalPrompt ?? "", taskPrompt: task.confirmedTaskPrompt ?? "", constraints: {}, parameters: selection });
      }
      if (active) setRecord({ projectId, steps });
    }).catch(() => { /* Existing results remain viewable with explicitly unknown metadata. */ });
    return () => { active = false; };
  }, [projectId, revision]);
  return record.projectId === projectId ? record.steps : [];
}

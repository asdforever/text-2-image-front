import React, { useEffect, useRef, useState } from "react";
import { GenerationWorkerNotice } from "../components/generation-workspace/GenerationWorkerNotice";
import { getRetryableBatchSlotIds } from "../lib/batch-retry";
import { PanelLeftClose } from "lucide-react";
import type { Asset, Project } from "../api/contracts";
import {
  batchGenerationApi,
  heroGenerationApi,
  projectApi,
  createIdempotencyKey,
  type ApiBatchGenerationDetail,
  type ApiBatchHeroPromptCompileInput,
  type ApiHeroGenerationTask,
} from "../api/client";
import { HeroConfigPanel } from "../components/HeroConfigPanel";
import { GenerationFooter, GenerationWorkspaceLayout } from "../components/generation-workspace";
import { useGenerationResultMetadata } from "../hooks/useGenerationResultMetadata";
import { generationResultImages } from "../lib/generation-results";
import { GenerationTaskStatus } from "../components/generation-workspace/GenerationTaskStatus";
import { GenerationImageStage } from "../components/generation-workspace/GenerationImageStage";
import { Button } from "../components/ui/button";
import {
  HERO_MODULES,
  getCompactModuleParameters,
  getStyleLabel,
  normalizeHeroConfig,
  validateHeroConfig,
  type HeroGenerationConfig,
} from "../lib/generation-workspace";
import { createGenerationSnapshot, validateGenerationSelection } from "../lib/generation-config";
import { needsModulePlan } from "../lib/planning-master";
import { useModulePlanning } from "../hooks/useModulePlanning";
import { moduleReverseReference } from "../features/reverse-projects/planning";
import { useProjectStore } from "../store/useProjectStore";
import { usePublishedGenerationConfig } from "../hooks/usePublishedGenerationConfig";
import { useTaskRecovery } from "../hooks/useTaskRecovery";
import {
  compileBatchHeroGenerationFlow,
  compileHeroGenerationFlow,
  confirmBatchHeroGenerationFlow,
  confirmHeroGenerationFlow,
  validateBatchHeroSelection,
} from "../lib/hero-generation-flow";

interface HeroImageWorkspaceProps {
  project: Project;
  selectionMode: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onSelectAsset: (asset: Asset) => void;
  onToast: (message: string) => void;
  onRefresh?: () => Promise<void> | void;
  focusAssetId?: string | null;
}

export function HeroPromptConfirmation(_props: {
  task: ApiHeroGenerationTask;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const props = _props;
  const prompt = props.task.compiledTaskPrompt ?? "";
  const cards = [
    ["商品真实性约束", props.task.constraints.authenticity],
    ["具体电商平台约束", props.task.constraints.market],
    ["全局风格约束", props.task.constraints.style],
  ] as const;
  return (
    <section className="hero-prompt-confirmation" aria-label="主图提示词确认">
      <header><div><span>生成前确认</span><h2>检查本次实时任务提示词</h2></div><button type="button" onClick={props.onCancel} disabled={props.busy}>取消</button></header>
      <details className="studio-prompt-context"><summary>查看固定约束与图片分析</summary>
      <div className="hero-constraint-grid">
        {cards.map(([label, card]) => <article key={label}><span>{label}</span><p>{card.content}</p></article>)}
      </div>
      <div className="hero-fact-grid">
        <section><strong>可见事实</strong>{props.task.visibleFacts.length ? <ul>{props.task.visibleFacts.map((item) => <li key={item}>{item}</li>)}</ul> : <p>未返回可见事实</p>}</section>
        <section><strong>无法确认项</strong>{props.task.unconfirmedItems.length ? <ul>{props.task.unconfirmedItems.map((item) => <li key={item}>{item}</li>)}</ul> : <p>无</p>}</section>
      </div>
      </details>
      {props.task.unconfirmedItems.length > 0 && <p className="studio-unconfirmed">待核实：{props.task.unconfirmedItems.join("、")}</p>}
      <p>提示词已统一合成；如需调整，请修改左侧模块参数后重新编译。</p>
      <label className="hero-task-prompt-field">实时任务提示词<textarea value={prompt} readOnly disabled={props.busy} /></label>
      <footer><span>确认后将调用生图模型并生成 1 张图片</span><Button type="button" disabled={props.busy || !prompt.trim()} onClick={props.onConfirm}>{props.busy ? "生成中..." : "确认并生成"}</Button></footer>
    </section>
  );
}

export function BatchPromptConfirmation(_props: {
  batch: ApiBatchGenerationDetail;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const props = _props;
  const total = props.batch.modules.reduce((sum, module) => sum + module.resultCount, 0);
  const modulePrompt = (module: ApiBatchGenerationDetail["modules"][number]) =>
    module.compiledTaskPrompt ?? "";
  const hasEmptyPrompt = props.batch.modules.some((module) => !modulePrompt(module).trim());
  return (
    <section className="hero-prompt-confirmation" aria-label="批次主图提示词确认">
      <header><div><span>生成前确认</span><h2>逐个检查模块实时任务提示词</h2></div><button type="button" onClick={props.onCancel} disabled={props.busy}>取消</button></header>
      <p>提示词已统一合成；如需调整，请修改左侧模块参数后重新编译。</p>
      <div className="hero-batch-prompt-list">
        {props.batch.modules.map((module) => {
          const cards = [
            ["商品真实性约束", module.constraints.authenticity],
            ["具体电商平台约束", module.constraints.market],
            ["全局风格约束", module.constraints.style],
          ] as const;
          const label = module.moduleLabel ?? HERO_MODULES.find((item) => item.id === (module.moduleId ?? module.moduleKey))?.label ?? module.moduleKey;
          return <article className="hero-batch-prompt-module" key={module.id}>
            <header><div><strong>{label}</strong><span>生成 {module.resultCount} 张</span></div></header>
            <details className="studio-prompt-context"><summary>查看固定约束与图片分析</summary>
            <div className="hero-constraint-grid">
              {cards.map(([cardLabel, card]) => <article key={cardLabel}><span>{cardLabel}</span><p>{card?.content ?? "未返回约束"}</p></article>)}
            </div>
            <div className="hero-fact-grid">
              <section><strong>可见事实</strong>{module.visibleFacts.length ? <ul>{module.visibleFacts.map((item) => <li key={item}>{item}</li>)}</ul> : <p>未返回可见事实</p>}</section>
              <section><strong>无法确认项</strong>{module.unconfirmedItems.length ? <ul>{module.unconfirmedItems.map((item) => <li key={item}>{item}</li>)}</ul> : <p>无</p>}</section>
            </div>
            </details>
            {module.unconfirmedItems.length > 0 && <p className="studio-unconfirmed">待核实：{module.unconfirmedItems.join("、")}</p>}
            <label className="hero-task-prompt-field">实时任务提示词<textarea value={modulePrompt(module)} readOnly disabled={props.busy} /></label>
          </article>;
        })}
      </div>
      <footer><span>确认后开始生成，共 {total} 张图片</span><Button type="button" disabled={props.busy || hasEmptyPrompt} onClick={props.onConfirm}>{props.busy ? "确认中..." : "确认并开始批次生成"}</Button></footer>
    </section>
  );
}

export function BatchGenerationStatus(_props: {
  batch: ApiBatchGenerationDetail;
  busy: boolean;
  onCancel: () => void;
  onRetry: (slotId: string) => void;
  onRetryAll?: () => void;
  onRecompile?: () => void;
  moduleLabels?: Record<string, string>;
  onSelect?: (assetId: string) => void;
}) {
  const props = _props;
  const retryable = new Set(getRetryableBatchSlotIds(props.batch.slots));
  const labelFor = (key: string) => props.moduleLabels?.[key] ?? HERO_MODULES.find((item) => item.id === key)?.label ?? key;
  return (
    <section className="hero-batch-status" aria-label="批次图片进度">
      <header>
        <div><span>批次生成</span><h2>成功 {props.batch.progress.succeeded} / {props.batch.progress.total}</h2></div>
        {!( ["succeeded", "partially_failed", "failed", "cancelled"] as string[]).includes(props.batch.status) && <Button type="button" variant="secondary" disabled={props.busy} onClick={props.onCancel}>取消批次</Button>}
        {props.onRetryAll && retryable.size > 0 && <Button type="button" variant="secondary" disabled={props.busy} onClick={props.onRetryAll}>一键重试失败项（{retryable.size}）</Button>}
        {props.onRecompile && ["cancelled", "failed", "partially_failed"].includes(props.batch.status) && <Button type="button" variant="secondary" disabled={props.busy} onClick={props.onRecompile}>重新编译提示词</Button>}
      </header>
      <div className="hero-batch-module-progress">
        {props.batch.modules.map((module) => {
          const slots = props.batch.slots.filter((slot) => slot.moduleTaskId === module.id);
          const completed = slots.filter((slot) => slot.status === "succeeded").length;
          const label = labelFor(module.moduleKey);
          return <span key={module.id}>{label}：{completed} / {module.resultCount}</span>;
        })}
      </div>
      <GenerationWorkerNotice queued={props.batch.progress.queued + props.batch.progress.leased} />
      <div className="hero-batch-slot-grid">
        {props.batch.slots.map((slot) => <article className="hero-batch-slot" key={slot.id}>
          <header><strong>{labelFor(slot.moduleKey)} · 第 {slot.ordinal} 张</strong><span>{slotStatusLabel(slot.status)}</span></header>
          {slot.generatedAssetPreviewUrl ? <a href={slot.generatedAssetPreviewUrl} target="_blank" rel="noreferrer" aria-label={`查看${labelFor(slot.moduleKey)}第 ${slot.ordinal} 张`} onClick={(event) => { if (props.onSelect && slot.generatedAssetId) { event.preventDefault(); props.onSelect(slot.generatedAssetId); } }}><img src={slot.generatedAssetPreviewUrl} alt={`${labelFor(slot.moduleKey)}第 ${slot.ordinal} 张`} /></a> : <div className="hero-batch-slot-placeholder">{slotStatusLabel(slot.status)}</div>}
          {slot.error?.message && <p className="hero-generation-error" role="alert">{slot.error.message}</p>}
          {retryable.has(slot.status) && <Button type="button" variant="secondary" disabled={props.busy} onClick={() => props.onRetry(slot.id)}>重试此张</Button>}
        </article>)}
      </div>
    </section>
  );
}

function slotStatusLabel(status: string) {
  return ({
    queued: "等待生成",
    leased: "已领取",
    dispatching: "正在请求模型",
    succeeded: "已完成",
    failed: "生成失败",
    cancel_requested: "正在取消",
    cancelled: "已取消",
    needs_retry: "需要人工重试",
  } as Record<string, string>)[status] ?? status;
}

export function BatchGenerationProgress({ batch }: { batch: ApiBatchGenerationDetail }) {
  const { succeeded, total, failed, cancelled, needsRetry } = batch.progress;
  const percent = (count: number, size: number) => Math.round(count * 100 / Math.max(1, size));
  const status = batch.status === "succeeded" ? "completed" : batch.status === "partially_failed" ? "partial" : batch.status;
  return <div className={"generation-run-status status-" + status}>
    任务进度 · {succeeded}/{total} · {percent(succeeded, total)}%<span>（按成功图片统计）</span>
    <div className="generation-module-statuses">{batch.modules.map((module) => {
      const done = batch.slots.filter((slot) => slot.moduleTaskId === module.id && slot.status === "succeeded").length;
      return <span key={module.id}>{module.moduleLabel ?? HERO_MODULES.find((item) => item.id === (module.moduleId ?? module.moduleKey))?.label ?? module.moduleKey}：{percent(done, module.resultCount)}%</span>;
    })}</div>
    {failed > 0 && <span>失败 {failed} 张</span>}
    {cancelled > 0 && <span>已取消 {cancelled} 张</span>}
    {needsRetry > 0 && <span>待重试 {needsRetry} 张</span>}
  </div>;
}

export function HeroImageWorkspace(props: HeroImageWorkspaceProps) {
  const key = props.project.id + ":hero";
  const record = useProjectStore((state) => state.generationDrafts[key]);
  const run = useProjectStore((state) => state.generationRuns[key]);
  const updateDraft = useProjectStore((state) => state.updateGenerationDraft);
  const startRun = useProjectStore((state) => state.startGenerationRun);
  const updateRunModule = useProjectStore((state) => state.updateGenerationRunModule);
  const saveGenerationSnapshot = useProjectStore((state) => state.saveGenerationSnapshot);
  const heroGenerationSession = useProjectStore((state) => state.heroGenerationSessions[props.project.id]);
  const saveHeroGenerationSession = useProjectStore((state) => state.saveHeroGenerationSession);
  const clearHeroGenerationSession = useProjectStore((state) => state.clearHeroGenerationSession);
  const { publishedConfig, status: generationConfigStatus, error: generationConfigError } = usePublishedGenerationConfig();
  const config = normalizeHeroConfig(record?.config as Partial<HeroGenerationConfig> | undefined);
  const modulePlanner = useModulePlanning(props.project.id, "hero");
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittingCompile, setSubmittingCompile] = useState(false);
  const [task, setTask] = useState<ApiHeroGenerationTask | null>(null);
  const [batch, setBatch] = useState<ApiBatchGenerationDetail | null>(null);
  const resultMetadata = useGenerationResultMetadata(props.project.id, props.project.assets);
  const [moduleTaskPrompts, setModuleTaskPrompts] = useState<Record<string, string>>({});
  const [flowError, setFlowError] = useState("");
  const seenSuccessfulBatchSlotIds = useRef<Set<string>>(new Set());
  const resultImages = generationResultImages(props.project.assets, "hero", resultMetadata, batch);
  const preparing = modulePlanner.planning || submittingCompile;
  const taskPending = preparing || !!batch && ["compiling_prompt", "queued", "running", "cancel_requested"].includes(batch.status) || task?.status === "generating";
  const recovery = useTaskRecovery({
    identity: `${props.project.id}:${heroGenerationSession?.compileIdempotencyKey}:${heroGenerationSession?.batchId}:${batch?.status}`,
    enabled: !!heroGenerationSession && !heroGenerationSession.taskId,
    read: () => heroGenerationSession?.batchId
      ? batchGenerationApi.get(props.project.id, heroGenerationSession.batchId)
      : batchGenerationApi.recover(props.project.id, heroGenerationSession!.compileIdempotencyKey),
    onValue: async (recovered) => {
      setBatch(recovered);
      const saved = useProjectStore.getState().heroGenerationSessions[props.project.id];
      if (saved?.compileIdempotencyKey === heroGenerationSession?.compileIdempotencyKey) {
        if (saved.batchId !== recovered.id) saveHeroGenerationSession(props.project.id, { ...saved, batchId: recovered.id });
        setModuleTaskPrompts(Object.fromEntries(recovered.modules.map((module) => [module.moduleKey,
          module.confirmedTaskPrompt ?? module.compiledTaskPrompt ?? "",
        ])));
      }
      const successes = recovered.slots.filter((slot) => slot.status === "succeeded" && !seenSuccessfulBatchSlotIds.current.has(slot.id));
      if (successes.length) {
        await props.onRefresh?.();
        successes.forEach((slot) => seenSuccessfulBatchSlotIds.current.add(slot.id));
      }
    },
    shouldPoll: (value) => ["compiling_prompt", "queued", "running", "cancel_requested"].includes(value.status),
  });
  useEffect(() => {
    if (!heroGenerationSession?.taskId) return;
    let cancelled = false;
    void heroGenerationApi.get(props.project.id, heroGenerationSession.taskId)
      .then((recovered) => {
        if (cancelled) return;
        setTask(recovered);
        setFlowError(recovered.status === "failed" ? recovered.error?.message ?? "主图生成失败" : "");
      })
      .catch((error) => {
        if (!cancelled) setFlowError(error instanceof Error ? error.message : "主图任务恢复失败");
      });
    return () => { cancelled = true; };
  }, [heroGenerationSession?.taskId, props.project.id]);
  const selectedModel = publishedConfig.models.find((item) => item.id === config.model || item.label === config.model);
  const selection = { marketId: config.market, modelId: selectedModel?.id ?? config.model, styleId: config.styleId, moduleIds: config.selectedModuleIds, moduleTypes: config.moduleTypes, moduleCounts: config.moduleCounts, outputLanguage: config.outputLanguage, aspectRatio: config.aspectRatio, resolution: config.resolution, customStyle: config.customStyle, moduleParameters: config.moduleParameters };
  const remoteConfigErrors = generationConfigStatus === "ready" ? [] : [generationConfigStatus === "error" ? generationConfigError : "正在加载已发布生成配置"];
  const batchSelectionErrors = validateBatchHeroSelection(config.selectedAssetIds, config.selectedModuleIds, config.moduleCounts);
  const errors = attempted ? [...remoteConfigErrors, ...validateHeroConfig(config), ...validateGenerationSelection(publishedConfig, selection), ...batchSelectionErrors] : [];

  const focusFirstInvalid = () => {
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const invalid = document.querySelector<HTMLElement>("[data-generation-invalid='true']");
      invalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      invalid?.querySelector<HTMLElement>("button, input, textarea, select")?.focus();
    });
  };

  const change = (patch: Partial<HeroGenerationConfig>) => updateDraft(props.project.id, "hero", patch);
  const upload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const asset = await projectApi.uploadAsset(props.project.id, "source", file);
      change({ selectedAssetIds: [asset.id] });
      await props.onRefresh?.();
      props.onToast("产品素材已上传");
    } catch (error) {
      props.onToast(error instanceof Error ? error.message : "产品素材上传失败");
    }
  };
  const selectedStyle = publishedConfig.styleCategories.flatMap((category) => category.styles).find((style) => style.id === config.styleId);
  const styleName = selectedStyle?.label ?? getStyleLabel(config.styleId, config.customStyle);

  const generate = async (forceNewCompile = false) => {
    if (busy || modulePlanner.planning || recovery.loading || batch?.status === "compiling_prompt") return;
    setAttempted(true);
    let effectiveConfig = config;
    setBusy(true);
    try { if (modulePlanner.references) effectiveConfig = normalizeHeroConfig(await modulePlanner.references.refresh()); }
    catch (cause) { setFlowError(cause instanceof Error ? cause.message : "反推引用读取失败"); setBusy(false); return; }
    setBusy(false);
    if (needsModulePlan(effectiveConfig)) {
      setBusy(true); setFlowError("");
      const planned = await modulePlanner.plan();
      setBusy(false);
      if (!planned) return;
      effectiveConfig = normalizeHeroConfig(planned);
    }
    const effectiveModelId = publishedConfig.models.find((item) => item.id === effectiveConfig.model || item.label === effectiveConfig.model)?.id ?? effectiveConfig.model;
    const effectiveSelection = { marketId: effectiveConfig.market, modelId: effectiveModelId, styleId: effectiveConfig.styleId, moduleIds: effectiveConfig.selectedModuleIds, moduleTypes: effectiveConfig.moduleTypes, moduleCounts: effectiveConfig.moduleCounts, outputLanguage: effectiveConfig.outputLanguage, aspectRatio: effectiveConfig.aspectRatio, resolution: effectiveConfig.resolution, customStyle: effectiveConfig.customStyle, moduleParameters: effectiveConfig.moduleParameters };
    const nextErrors = [...remoteConfigErrors, ...validateHeroConfig(effectiveConfig), ...validateGenerationSelection(publishedConfig, effectiveSelection), ...validateBatchHeroSelection(effectiveConfig.selectedAssetIds, effectiveConfig.selectedModuleIds, effectiveConfig.moduleCounts)];
    if (nextErrors.length > 0) { focusFirstInvalid(); return; }
    const sourceId = effectiveConfig.selectedAssetIds[0];
    if (!sourceId || !effectiveConfig.styleId) return;
    setBusy(true);
    setSubmittingCompile(true);
    setFlowError("");
    saveGenerationSnapshot(props.project.id, "hero", createGenerationSnapshot(publishedConfig, effectiveSelection));
    startRun(props.project.id, "hero", effectiveConfig.selectedModuleIds, "planning");
    props.onToast("正在分析产品图并编译提示词");
    const input: ApiBatchHeroPromptCompileInput = {
      sourceAssetId: sourceId,
      marketId: effectiveConfig.market,
      modelId: effectiveModelId,
      styleId: effectiveConfig.styleId,
      aspectRatio: effectiveConfig.aspectRatio,
      resolution: effectiveConfig.resolution,
      outputLanguage: effectiveConfig.outputLanguage,
      customStyle: effectiveConfig.customStyle,
      modulePlanId: effectiveConfig.modulePlanId,
      reverseVersionId: effectiveConfig.reverseVersionId,
      modules: effectiveConfig.selectedModuleIds.map((taskId) => ({
        taskId,
        moduleId: effectiveConfig.moduleTypes?.[taskId] ?? taskId,
        resultCount: 1,
        moduleParameters: getCompactModuleParameters(effectiveConfig.moduleParameters, taskId),
        reverseReference: moduleReverseReference(effectiveConfig, taskId),
      })),
    };
    const inputFingerprint = JSON.stringify(input);
    try {
      const previousSession = heroGenerationSession?.inputFingerprint === inputFingerprint ? heroGenerationSession : undefined;
      const pendingCompile = previousSession && !previousSession.taskId
        && (!previousSession.batchId || (batch && batch.id !== previousSession.batchId));
      const restart = forceNewCompile && !pendingCompile;
      // 刷新后可能尚未恢复本地 batch，先读取旧批次状态，不能把终态当作请求重试。
      const previousBatch = !restart && previousSession?.batchId
        ? batch?.id === previousSession.batchId ? batch : await batchGenerationApi.get(props.project.id, previousSession.batchId)
        : null;
      const ended = previousBatch && ["succeeded", "partially_failed", "failed", "cancelled"].includes(previousBatch.status);
      const session = !restart && !ended && previousSession ? previousSession : {
        inputFingerprint,
        compileIdempotencyKey: createIdempotencyKey(),
        confirmIdempotencyKey: createIdempotencyKey(),
      };
      // 没拿到批次 ID 的网络重试仍复用幂等键；明确重新编译才开启新批次。
      saveHeroGenerationSession(props.project.id, session);
      const compiled = await compileBatchHeroGenerationFlow(batchGenerationApi, props.project.id, input, session.compileIdempotencyKey);
      const currentSession = useProjectStore.getState().heroGenerationSessions[props.project.id];
      if (currentSession?.compileIdempotencyKey !== session.compileIdempotencyKey) return;
      const savedSession = { ...currentSession, batchId: compiled.id };
      saveHeroGenerationSession(props.project.id, savedSession);
      const detail = await batchGenerationApi.get(props.project.id, compiled.id);
      seenSuccessfulBatchSlotIds.current = new Set(detail.slots.filter((slot) => slot.status === "succeeded").map((slot) => slot.id));
      setTask(null);
      setBatch(detail);
      setModuleTaskPrompts(Object.fromEntries(detail.modules.map((module) => [module.moduleKey, module.compiledTaskPrompt ?? ""])));
      props.onToast("提示词已编译，请确认后生成");
    } catch (error) {
      const message = error instanceof Error ? error.message : "提示词编译失败";
      setFlowError(message);
      effectiveConfig.selectedModuleIds.forEach((moduleId) => {
        updateRunModule(props.project.id, "hero", moduleId, { status: "failed", error: message });
      });
    } finally {
      setBusy(false);
      setSubmittingCompile(false);
    }
  };

  const confirmBatchGeneration = async () => {
    if (!batch || busy) return;
    setBusy(true);
    setFlowError("");
    batch.modules.forEach((module) => {
      updateRunModule(props.project.id, "hero", module.moduleKey, { status: "generating", progress: 0, error: undefined });
    });
    try {
      const session = heroGenerationSession ?? {
        inputFingerprint: "recovered-batch:" + batch.id,
        compileIdempotencyKey: createIdempotencyKey(),
        confirmIdempotencyKey: createIdempotencyKey(),
        batchId: batch.id,
      };
      const savedSession = { ...session, batchId: batch.id };
      saveHeroGenerationSession(props.project.id, savedSession);
      const confirmed = await confirmBatchHeroGenerationFlow(
        batchGenerationApi,
        props.project.id,
        batch.id,
        Object.fromEntries(batch.modules.map((module) => [module.moduleKey, module.compiledTaskPrompt ?? ""])),
        savedSession.confirmIdempotencyKey,
      );
      setBatch(confirmed);
      setModuleTaskPrompts(Object.fromEntries(confirmed.modules.map((module) => [module.moduleKey, module.confirmedTaskPrompt ?? moduleTaskPrompts[module.moduleKey] ?? ""])));
      props.onToast("批次已确认，正在等待生成 Worker 执行");
    } catch (error) {
      const message = error instanceof Error ? error.message : "批次确认失败";
      setFlowError(message);
      batch.modules.forEach((module) => {
        updateRunModule(props.project.id, "hero", module.moduleKey, { status: "failed", error: message });
      });
    } finally {
      setBusy(false);
    }
  };

  const cancelBatchGeneration = async () => {
    if (!batch || busy) return;
    setBusy(true);
    setFlowError("");
    try {
      const cancelled = await batchGenerationApi.cancel(props.project.id, batch.id);
      setBatch(cancelled);
      props.onToast("已请求取消批次，未开始的图片将不再生成");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "取消批次失败");
    } finally {
      setBusy(false);
    }
  };

  const retryBatchSlot = async (slotId: string) => {
    if (!batch || busy) return;
    setBusy(true);
    setFlowError("");
    try {
      await batchGenerationApi.retrySlot(props.project.id, batch.id, slotId);
      const refreshed = await batchGenerationApi.get(props.project.id, batch.id);
      setBatch(refreshed);
      props.onToast("已将该图片重新加入生成队列");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "重试图片失败");
    } finally {
      setBusy(false);
    }
  };

  const confirmGeneration = async () => {
    if (!task || busy) return;
    const moduleId = config.selectedModuleIds[0];
    setBusy(true);
    setFlowError("");
    if (moduleId) updateRunModule(props.project.id, "hero", moduleId, { status: "generating", progress: 50, error: undefined });
    try {
      const session = heroGenerationSession ?? {
        inputFingerprint: "recovered-task:" + task.id,
        compileIdempotencyKey: createIdempotencyKey(),
        confirmIdempotencyKey: createIdempotencyKey(),
        taskId: task.id,
      };
      const prompt = task.compiledTaskPrompt ?? "";
      const savedSession = { ...session, taskId: task.id, taskPrompt: prompt };
      saveHeroGenerationSession(props.project.id, savedSession);
      const completed = await confirmHeroGenerationFlow(heroGenerationApi, props.project.id, task.id, prompt, savedSession.confirmIdempotencyKey);
      setTask(completed);
      saveHeroGenerationSession(props.project.id, { ...savedSession, taskPrompt: completed.confirmedTaskPrompt ?? prompt });
      if (moduleId) updateRunModule(props.project.id, "hero", moduleId, { status: "completed", progress: 100, error: undefined });
      await props.onRefresh?.();
      props.onToast("主图生成完成");
    } catch (error) {
      const message = error instanceof Error ? error.message : "主图生成失败";
      setFlowError(message);
      if (moduleId) updateRunModule(props.project.id, "hero", moduleId, { status: "failed", error: message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (asset: Asset) => {
    if (window.confirm("确定删除“" + asset.name + "”吗？此操作不会影响其他生成结果。")) {
      try { await projectApi.removeAsset(props.project.id, asset.id); await props.onRefresh?.(); }
      catch (error) { props.onToast(error instanceof Error ? error.message : "删除失败"); }
    }
  };

  const result = (
    <div className="generation-result-shell">
      <div className="studio-result-topbar">
      <header className="generation-result-header">
      <div><h1>主图</h1><small>当前配置：{config.aspectRatio} · {config.resolution} · {styleName}</small></div>
        {!collapsed && <Button size="icon" variant="ghost" title="收起配置" aria-label="收起配置" onClick={() => setCollapsed(true)}><PanelLeftClose size={16} /></Button>}
      </header>
      </div>
      <GenerationTaskStatus batch={preparing ? null : batch} status={modulePlanner.planning ? "planning" : preparing ? "compiling_prompt" : batch?.status ?? task?.status} moduleCount={preparing ? config.selectedModuleIds.length : batch?.modules.length ?? (task ? 1 : 0)} loading={recovery.loading} reconnecting={!!recovery.error} />
      <div className="generation-result-body">
        {recovery.missing && <p role="status">正在查询已提交的主图任务，尚未找到记录。不会自动重新生成。</p>}
        {(task?.status === "awaiting_confirmation" || batch?.status === "awaiting_confirmation") && <details className="studio-confirmation-details" open key={batch?.id ?? task?.id}><summary>提示词已就绪 · 检查并确认生成</summary>
        {task?.status === "awaiting_confirmation" && <HeroPromptConfirmation task={task} busy={busy} onConfirm={() => void confirmGeneration()} onCancel={() => { setTask(null); clearHeroGenerationSession(props.project.id); }} />}
        {batch?.status === "awaiting_confirmation" && <BatchPromptConfirmation batch={batch} busy={busy} onConfirm={() => void confirmBatchGeneration()} onCancel={() => { setBatch(null); setModuleTaskPrompts({}); clearHeroGenerationSession(props.project.id); }} />}
        </details>}
        {!preparing && batch && !["awaiting_confirmation", "compiling_prompt"].includes(batch.status) && <details className="studio-task-details" open={["failed", "partially_failed"].includes(batch.status)}><summary>批次进度与重试</summary><BatchGenerationStatus batch={batch} busy={busy} onCancel={() => void cancelBatchGeneration()} onRetry={(slotId) => void retryBatchSlot(slotId)} onRecompile={() => void generate(true)} /></details>}
        {task?.status === "generating" && <div className="generation-empty-state" role="status"><strong>正在生成主图</strong><span>已锁定平台、风格和商品真实性约束，请稍候。</span></div>}
        {(recovery.error || flowError || batch?.error?.message) && <div className="hero-generation-error" role="alert"><strong>{recovery.error ? "任务状态查询暂时中断" : "本次操作未完成"}</strong><span>{recovery.error || flowError || batch?.error?.message}</span></div>}
        {task?.status === "succeeded" && <section className="hero-generation-summary"><strong>本次生成快照</strong><span>最终提示词哈希：{task.finalPromptSha256}</span><details><summary>查看最终提示词</summary><pre>{task.finalPrompt}</pre></details></section>}
        <GenerationImageStage
          images={resultImages}
          activeBatchId={preparing ? undefined : batch?.id} taskPending={taskPending}
          source={props.project.assets.find((asset) => asset.id === config.selectedAssetIds[0])}
          emptyTitle="准备生成第一组主图" onInspect={props.onSelectAsset} onDelete={(asset) => void remove(asset)}
        />
      </div>
    </div>
  );

  return (
    <GenerationWorkspaceLayout
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      config={<HeroConfigPanel project={props.project} config={config} planner={modulePlanner} updatedAt={record?.updatedAt} errors={errors} onChange={change} onUpload={upload} onRefresh={props.onRefresh} />}
      footer={<GenerationFooter label="编译提示词" countLabel={`共 ${config.selectedModuleIds.length} 张 · 每项一张图`} errors={errors} busy={busy || recovery.loading || batch?.status === "compiling_prompt"} onSubmit={() => void generate()} />}
      result={result}
    />
  );
}

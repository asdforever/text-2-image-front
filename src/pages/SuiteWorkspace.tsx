import { belongsToCreationMode } from "../lib/creation-mode-label";
import React, { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Download, PanelLeftClose } from "lucide-react";
import type { Asset, Project } from "../api/contracts";
import {
  batchGenerationApi,
  createIdempotencyKey,
  projectApi,
  suitePlanningApi,
  type ApiBatchGenerationDetail,
  type ApiSuitePlan,
} from "../api/client";
import { SuiteConfigPanel } from "../components/SuiteConfigPanel";
import { GenerationModulesPanel } from "../components/generation-workspace/GenerationModulesPanel";
import { CreationModeSwitch } from "../components/generation-workspace/CreationModeSwitch";
import { GenerationFooter, GenerationWorkspaceLayout } from "../components/generation-workspace";
import { useGenerationResultMetadata } from "../hooks/useGenerationResultMetadata";
import { generationResultImages } from "../lib/generation-results";
import { GenerationTaskStatus } from "../components/generation-workspace/GenerationTaskStatus";
import { GenerationImageStage } from "../components/generation-workspace/GenerationImageStage";
import { BatchGenerationStatus } from "./HeroImageWorkspace";
import { type SuitePromptDraft, readSuitePromptDraft, saveSuitePromptDraft, suiteConfirmationKey } from "../lib/suite-prompt-draft";
import { Button } from "../components/ui/button";
import {
  getStyleLabel,
  getCompactModuleParameters,
  SUITE_MODULES,
  normalizeSuiteConfig,
  validateSuiteConfig,
  type SuiteGenerationConfig,
} from "../lib/generation-workspace";
import { createGenerationSnapshot, validateGenerationSelection } from "../lib/generation-config";
import { canCompileRegular, needsModulePlan } from "../lib/planning-master";
import { useModulePlanning } from "../hooks/useModulePlanning";
import { moduleReverseReference } from "../features/reverse-projects/planning";
import { useProjectStore } from "../store/useProjectStore";
import { usePublishedGenerationConfig } from "../hooks/usePublishedGenerationConfig";
import { useTaskRecovery } from "../hooks/useTaskRecovery";
import { getRetryableBatchSlotIds, retryBatchSlots } from "../lib/batch-retry";
import { readSuitePlanForRecovery } from "../lib/suite-plan-recovery";

export function SuiteWorkspace(props: {
  project: Project;
  onToast: (message: string) => void;
  onSelectAsset?: (asset: Asset) => void;
  onRefresh?: () => Promise<void> | void;
}) {
  const key = props.project.id + ":suite";
  const record = useProjectStore((state) => state.generationDrafts[key]);
  const updateDraft = useProjectStore((state) => state.updateGenerationDraft);
  const saveGenerationSnapshot = useProjectStore((state) => state.saveGenerationSnapshot);
  const session = useProjectStore((state) => state.suiteGenerationSessions?.[props.project.id]);
  const saveSession = useProjectStore((state) => state.saveSuiteGenerationSession);
  const { publishedConfig, status: generationConfigStatus, error: generationConfigError } = usePublishedGenerationConfig();
  const config = normalizeSuiteConfig(record?.config as Partial<SuiteGenerationConfig> | undefined);
  const modulePlanner = useModulePlanning(props.project.id, "suite");
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [storedPlan, setRemotePlan] = useState<ApiSuitePlan | null>(null);
  const [storedBatch, setRemoteBatch] = useState<ApiBatchGenerationDetail | null>(null);
  const remotePlan = belongsToCreationMode(storedPlan, config.creationMode) ? storedPlan : null;
  const remoteBatch = belongsToCreationMode(storedBatch, config.creationMode) ? storedBatch : null;
  const [pollVersion, setPollVersion] = useState(0);
  const [flowError, setFlowError] = useState("");
  useEffect(() => { setFlowError(""); }, [config.creationMode]);
  const [draft, setDraft] = useState<SuitePromptDraft>({ prompts: {} });
  const operationLock = useRef(false);
  const seenSuccessfulSlots = useRef(new Set<string>());
  const awaitingConfirmation = remotePlan?.status === "awaiting_confirmation";
  const compiling = remotePlan?.status === "compiling";
  const preparing = modulePlanner.planning || submittingPlan || compiling;
  const batchActive = !!remoteBatch && ["queued", "running", "cancel_requested"].includes(remoteBatch.status);
  const total = remotePlan?.modules.reduce((sum, module) => sum + module.resultCount, 0) ?? 0;
  const plans = remotePlan?.modules.map((module) => ({
    moduleId: module.moduleKey,
    moduleRecordId: module.id,
    count: module.resultCount,
    title: module.title,
    copy: module.copySummary,
    visual: module.visualDirection,
    taskPrompt: module.compiledTaskPrompt ?? "",
    moduleParameters: module.moduleParameters,
  })) ?? [];
  const resultMetadata = useGenerationResultMetadata(props.project.id, props.project.assets);
  const resultImages = generationResultImages(props.project.assets, "suite", resultMetadata, storedBatch, config.creationMode ?? "professional");
  const visibleAssetIds = new Set(resultImages.map(image => image.id));
  const suiteAssets = props.project.assets.filter(asset => visibleAssetIds.has(asset.id)).flatMap((asset) => {
    const slot = remoteBatch?.slots.find((candidate) => candidate.generatedAssetId === asset.id);
    return asset.type === "suite" || slot ? [{ ...asset, category: slot?.moduleKey ?? asset.category, sequence: slot?.ordinal ?? asset.sequence }] : [];
  }).sort((a, b) => {
    const position = (asset: Asset) => plans.findIndex((plan) => plan.moduleId === asset.category);
    const left = position(a), right = position(b);
    return (left < 0 ? plans.length : left) - (right < 0 ? plans.length : right) || (a.sequence ?? 0) - (b.sequence ?? 0);
  });
  const moduleSlots = (moduleId: string) => remoteBatch?.slots
    .filter((slot) => slot.moduleKey === moduleId)
    .sort((a, b) => a.ordinal - b.ordinal) ?? [];
  const selectedModel = publishedConfig.models.find((item) => item.id === config.model || item.label === config.model);
  const selection = { marketId: config.market, modelId: selectedModel?.id ?? config.model, styleId: config.styleId, moduleIds: config.selectedModuleIds, moduleTypes: config.moduleTypes, moduleCounts: config.moduleCounts, outputLanguage: config.outputLanguage, aspectRatio: config.aspectRatio, resolution: config.resolution, customStyle: config.customStyle, moduleParameters: config.moduleParameters };
  const remoteConfigErrors = generationConfigStatus === "ready" ? [] : [generationConfigStatus === "error" ? generationConfigError : "正在加载已发布生成配置"];
  const errors = attempted ? [...remoteConfigErrors, ...validateSuiteConfig(config, publishedConfig.suiteModules.length), ...validateGenerationSelection(publishedConfig, selection)] : [];

  useEffect(() => {
    if (!remotePlan) return;
    setDraft(readSuitePromptDraft(props.project.id, remotePlan.id));
  }, [props.project.id, remotePlan?.id]);

  const recovery = useTaskRecovery({
    identity: `${props.project.id}:${session?.compileIdempotencyKey ?? "latest"}:${session?.planId ?? ""}`,
    read: () => readSuitePlanForRecovery(
      session,
      (compileIdempotencyKey) => suitePlanningApi.recover(props.project.id, compileIdempotencyKey),
      (planId) => suitePlanningApi.get(props.project.id, planId),
      () => suitePlanningApi.getLatest(props.project.id),
    ),
    onValue: (value) => {
      // A GET started before confirmation may finish afterwards; never let that stale
      // snapshot move a confirmed plan back to awaiting confirmation.
      if (remotePlan && remotePlan.id === value.id && remotePlan.status === "confirmed"
        && value.status !== "confirmed" && value.revision <= remotePlan.revision) return;
      setRemotePlan(value);
      const savedSession = useProjectStore.getState().suiteGenerationSessions[props.project.id];
      if (!savedSession || savedSession.planId !== value.id) {
        saveSession(props.project.id, {
          compileIdempotencyKey: savedSession?.compileIdempotencyKey ?? "",
          planId: value.id,
        });
      }
    },
    shouldPoll: (value) => value.status === "compiling",
    // A persisted compile key can outlive the plan it created (for example
    // after a browser restore). In that case the latest project plan is the
    // safe recovery source and an empty project should remain a normal state.
    allowNotFound: !session?.planId,
  });
  const loadingPlan = recovery.loading;

  useEffect(() => {
    const batchId = storedPlan?.generationBatchId;
    if (!batchId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const value = await batchGenerationApi.get(props.project.id, batchId);
        if (!active) return;
        setRemoteBatch(value);
        setFlowError("");
        const successes = value.slots.filter((slot) => slot.status === "succeeded" && !seenSuccessfulSlots.current.has(slot.id));
        if (successes.length) {
          await props.onRefresh?.();
          if (!active) return;
          successes.forEach((slot) => seenSuccessfulSlots.current.add(slot.id));
        }
        if (["queued", "running", "cancel_requested"].includes(value.status)) {
          timer = setTimeout(() => void poll(), 1500);
        }
      } catch (error) {
        if (active) {
          setFlowError(error instanceof Error ? error.message : "套图进度读取失败，正在重连");
          timer = setTimeout(() => void poll(), 3000);
        }
      }
    };
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [props.project.id, storedPlan?.generationBatchId, pollVersion]);

  const focusFirstInvalid = () => {
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const invalid = document.querySelector<HTMLElement>("[data-generation-invalid='true']");
      invalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      invalid?.querySelector<HTMLElement>("button, input, textarea, select")?.focus();
    });
  };

  const change = (patch: Partial<SuiteGenerationConfig>) => updateDraft(props.project.id, "suite", patch);
  const upload = async (files: File[]) => {
    const capacity = Math.max(0, 4 - config.selectedAssetIds.length);
    const acceptedFiles = files.slice(0, capacity);
    const addedIds: string[] = [];
    for (const file of acceptedFiles) {
      try {
        const asset = await projectApi.uploadAsset(props.project.id, "source", file);
        addedIds.push(asset.id);
      } catch (error) {
        props.onToast(error instanceof Error ? error.message : `素材“${file.name}”上传失败`);
      }
    }
    if (addedIds.length) {
      change({ selectedAssetIds: [...config.selectedAssetIds, ...addedIds] });
      await props.onRefresh?.();
      props.onToast(`已上传 ${addedIds.length} 张产品素材`);
    }
    if (files.length > acceptedFiles.length) props.onToast("详情图最多选择 4 张素材，超出部分未添加");
  };

  const selectedStyle = publishedConfig.styleCategories.flatMap((category) => category.styles).find((style) => style.id === config.styleId);
  const styleName = selectedStyle?.label ?? getStyleLabel(config.styleId, config.customStyle);

  const generatePlan = async () => {
    if (operationLock.current || busy || modulePlanner.planning || compiling || recovery.error || batchActive || loadingPlan || (remotePlan?.status === "confirmed" && !remoteBatch)) return;
    if (awaitingConfirmation && !window.confirm("重新编译会替换当前待确认方案，继续吗？")) return;
    setAttempted(true);
    let effectiveConfig = config;
    setBusy(true);
    try { if (modulePlanner.references) effectiveConfig = normalizeSuiteConfig(await modulePlanner.references.refresh()); }
    catch (cause) { setFlowError(cause instanceof Error ? cause.message : "反推引用读取失败"); setBusy(false); return; }
    setBusy(false);
    if (needsModulePlan(effectiveConfig)) {
      setBusy(true); setFlowError("");
      const planned = await modulePlanner.plan();
      setBusy(false);
      if (!planned) return;
      effectiveConfig = normalizeSuiteConfig(planned);
    }
    const effectiveModelId = publishedConfig.models.find((item) => item.id === effectiveConfig.model || item.label === effectiveConfig.model)?.id ?? effectiveConfig.model;
    const effectiveSelection = { marketId: effectiveConfig.market, modelId: effectiveModelId, styleId: effectiveConfig.styleId, moduleIds: effectiveConfig.selectedModuleIds, moduleTypes: effectiveConfig.moduleTypes, moduleCounts: effectiveConfig.moduleCounts, outputLanguage: effectiveConfig.outputLanguage, aspectRatio: effectiveConfig.aspectRatio, resolution: effectiveConfig.resolution, customStyle: effectiveConfig.customStyle, moduleParameters: effectiveConfig.moduleParameters };
    const nextErrors = [...remoteConfigErrors, ...validateSuiteConfig(effectiveConfig, publishedConfig.suiteModules.length), ...validateGenerationSelection(publishedConfig, effectiveSelection)];
    if (nextErrors.length > 0) { focusFirstInvalid(); return; }
    operationLock.current = true;
    setSubmittingPlan(true);
    setBusy(true);
    setFlowError("");
    const retryingMissingSubmission = !!session?.compileIdempotencyKey && !session.planId && recovery.missing;
    const nextSession = retryingMissingSubmission
      ? session
      : { compileIdempotencyKey: createIdempotencyKey() };
    saveSession(props.project.id, nextSession);
    try {
      saveGenerationSnapshot(props.project.id, "suite", createGenerationSnapshot(publishedConfig, effectiveSelection));
      const value = await suitePlanningApi.compile(props.project.id, {
        creationMode: effectiveConfig.creationMode,
        userNotes: effectiveConfig.creationMode === "regular" ? effectiveConfig.userNotes : undefined,
        sourceAssetIds: effectiveConfig.selectedAssetIds,
        marketId: effectiveConfig.market,
        modelId: effectiveModelId,
        styleId: effectiveConfig.styleId ?? "",
        aspectRatio: effectiveConfig.aspectRatio,
        resolution: effectiveConfig.resolution,
        outputLanguage: effectiveConfig.outputLanguage,
        customStyle: effectiveConfig.customStyle,
        modulePlanId: effectiveConfig.modulePlanId,
        reverseVersionId: effectiveConfig.creationMode === "regular" ? undefined : effectiveConfig.reverseVersionId,
        modules: effectiveConfig.selectedModuleIds.map((taskId) => ({
          taskId,
          moduleId: effectiveConfig.moduleTypes?.[taskId] ?? taskId,
          resultCount: 1,
          moduleParameters: getCompactModuleParameters(effectiveConfig.moduleParameters, taskId),
          regularTask: effectiveConfig.creationMode === "regular" ? effectiveConfig.regularTaskOverrides?.[taskId] ?? effectiveConfig.regularTasks?.[taskId] : undefined,
          taskDesign: effectiveConfig.creationMode === "regular" ? undefined : effectiveConfig.moduleTaskOverrides?.[taskId],
          reverseReference: effectiveConfig.creationMode === "regular" ? undefined : moduleReverseReference(effectiveConfig, taskId),
        })),
      }, nextSession.compileIdempotencyKey);
      if (useProjectStore.getState().suiteGenerationSessions[props.project.id]?.compileIdempotencyKey !== nextSession.compileIdempotencyKey) return;
      saveSession(props.project.id, { ...nextSession, planId: value.id });
      setRemotePlan(value);
      setDraft(readSuitePromptDraft(props.project.id, value.id));
      setRemoteBatch(null);
      seenSuccessfulSlots.current.clear();
      if (window.innerWidth < 1024) setCollapsed(true);
      props.onToast("套图提示词已就绪，请检查后确认生成");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "套图提示词生成失败");
    } finally {
      operationLock.current = false;
      setSubmittingPlan(false);
      setBusy(false);
    }
  };

  const generateImages = async () => {
    if (!remotePlan || !awaitingConfirmation || !plans.length || operationLock.current) return;
    if (plans.some((plan) => !plan.taskPrompt.trim())) {
      setFlowError("每个模块都需要填写提示词");
      return;
    }
    operationLock.current = true;
    setBusy(true);
    setFlowError("");
    const prompts = Object.fromEntries(plans.map((plan) => [plan.moduleId, plan.taskPrompt]));
    const confirmation = suiteConfirmationKey(draft, remotePlan.id, prompts);
    setDraft(confirmation);
    saveSuitePromptDraft(props.project.id, confirmation);
    try {
      const confirmed = await suitePlanningApi.confirm(
        props.project.id, remotePlan.id, remotePlan.revision, prompts, confirmation.confirmKey!,
      );
      setRemotePlan(confirmed);
      // 轮询负责读取批次和刷新图片，确认成功后不再次提交生成请求。
      setPollVersion((value) => value + 1);
      props.onToast("已确认，开始生成套图");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "确认失败，提示词修改已保留，请重试");
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  };

  const cancelBatch = async () => {
    if (!remoteBatch || busy) return;
    setBusy(true);
    try {
      setRemoteBatch(await batchGenerationApi.cancel(props.project.id, remoteBatch.id));
      props.onToast("已请求取消套图批次");
    } catch (error) {
      props.onToast(error instanceof Error ? error.message : "取消套图失败");
    } finally {
      setBusy(false);
    }
  };

  const retrySlot = async (slotId: string) => {
    if (!remoteBatch || busy) return;
    setBusy(true);
    try {
      await batchGenerationApi.retrySlot(props.project.id, remoteBatch.id, slotId);
      setRemoteBatch(await batchGenerationApi.get(props.project.id, remoteBatch.id));
      setPollVersion((value) => value + 1);
      props.onToast("已提交该图片重试");
    } catch (error) {
      props.onToast(error instanceof Error ? error.message : "图片重试失败");
    } finally {
      setBusy(false);
    }
  };

  const retryFailedSlots = async () => {
    if (!remoteBatch || busy) return;
    const slotIds = getRetryableBatchSlotIds(remoteBatch.slots);
    if (!slotIds.length) return;
    setBusy(true);
    try {
      const result = await retryBatchSlots(slotIds, (slotId) => batchGenerationApi.retrySlot(props.project.id, remoteBatch.id, slotId));
      setRemoteBatch(await batchGenerationApi.get(props.project.id, remoteBatch.id));
      setPollVersion((value) => value + 1);
      props.onToast(result.failed ? `已提交 ${result.submitted}/${slotIds.length} 张重试，${result.failed} 张提交失败` : `已提交 ${result.submitted} 张失败图片重试`);
    } catch (error) {
      props.onToast(error instanceof Error ? error.message : "批量重试失败");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (asset: Asset) => {
    if (window.confirm("确定删除“" + asset.name + "”吗？此操作不会影响详情页规划。")) {
      try { await projectApi.removeAsset(props.project.id, asset.id); await props.onRefresh?.(); }
      catch (error) { props.onToast(error instanceof Error ? error.message : "删除图片失败"); }
    }
  };
  const exportSuite = async () => {
    const orderedSlots = plans.flatMap((plan) => moduleSlots(plan.moduleId).filter((slot) => slot.status === "succeeded" && slot.generatedAssetPreviewUrl));
    const ordered = remoteBatch && orderedSlots.length > 0 ? orderedSlots.map((slot) => ({ name: `${slot.moduleKey}-${slot.ordinal}.png`, url: slot.generatedAssetPreviewUrl! })) : plans.flatMap((plan) => suiteAssets.filter((asset) => asset.category === plan.moduleId).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).slice(0, plan.count ?? 1));
    const missing = plans.filter((plan) => {
      const count = remoteBatch ? moduleSlots(plan.moduleId).filter((slot) => slot.status === "succeeded").length : suiteAssets.filter((asset) => asset.category === plan.moduleId).length;
      return count < (plan.count ?? 1);
    });
    if (missing.length) props.onToast(`仍有 ${missing.length} 个模块未生成：${missing.map((item) => item.title).join("、")}`);
    if (!ordered.length) return;
    const zip = new JSZip();
    const failed: string[] = [];
    await Promise.all(ordered.map(async (asset, index) => {
      try {
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error("下载失败");
        zip.file(`${String(index + 1).padStart(2, "0")}-${asset.name}`, await response.arrayBuffer());
      } catch {
        failed.push(asset.name);
      }
    }));
    if (failed.length) props.onToast(`有 ${failed.length} 个模块导出失败：${failed.join("、")}`);
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${props.project.productName || "详情页"}-详情图.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const result = (
    <div className="generation-result-shell suite-unified">
      <div className="studio-result-topbar">
        <header className="generation-result-header">
          <div><h1>详情套图</h1><small>{`当前配置：${config.aspectRatio} · ${config.resolution} · ${styleName}`}</small></div>
          <div className="generation-result-header-actions">{!collapsed && <Button size="icon" variant="ghost" title="收起配置" aria-label="收起配置" onClick={() => setCollapsed(true)}><PanelLeftClose size={16} /></Button>}</div>
        </header>
      </div>
      <GenerationTaskStatus batch={preparing || modulePlanner.error ? null : remoteBatch} status={modulePlanner.planning ? "planning" : preparing ? "compiling" : modulePlanner.error ? "failed" : remoteBatch?.status ?? remotePlan?.status} moduleCount={preparing || modulePlanner.error ? config.selectedModuleIds.length : remotePlan?.modules.length} loading={loadingPlan} reconnecting={!!recovery.error} />
      <div className="generation-result-body">
        {(recovery.error || flowError || modulePlanner.error || remotePlan?.error?.message) && <div className="suite-flow-error" role="alert">{recovery.error || flowError || modulePlanner.error || remotePlan?.error?.message}</div>}
        <GenerationModulesPanel projectId={props.project.id} mode="suite" config={config} planner={modulePlanner} errors={errors} onChange={change} />
        {recovery.missing && <p role="status">正在查询已提交的套图任务，尚未找到记录。不会自动重新生成。</p>}
        {awaitingConfirmation && remotePlan && <section className="suite-prompt-confirmation" aria-label="套图提示词确认">
          <header className="suite-section-heading"><div><h2>检查套图提示词</h2><p>共 {total} 张。检查每张图的提示词，最终拼接顺序在画布中调整。</p></div></header>
          <p>提示词已统一合成；如需调整，请修改模块参数后重新编译。</p>
          <details className="studio-prompt-context suite-global-constraints"><summary>查看平台、风格与商品约束</summary>
            <div className="suite-constraint-cards">{Object.entries(remotePlan.constraints).map(([key, card]) => <article key={key}><strong>{key === "market" ? "电商平台约束" : key === "style" ? "全局风格约束" : key === "authenticity" ? "商品真实性约束" : key}</strong><p>{card.content}</p></article>)}</div>
          </details>
          <div className="suite-prompt-list">{plans.map((plan, index) => {
            const module = remotePlan.modules.find((item) => item.moduleKey === plan.moduleId)!;
            return <article className="suite-prompt-card" key={plan.moduleId}>
              <header><div className="suite-prompt-title"><span className="suite-order-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{plan.title}</strong><small>生成 {plan.count} 张</small></div></div>
              </header>
              <label className="hero-task-prompt-field"><span>任务提示词</span><textarea aria-label={`${plan.title}提示词`} value={plan.taskPrompt} readOnly disabled={busy} /></label>
              {module.unconfirmedItems.length > 0 && <p className="studio-unconfirmed">待核实：{module.unconfirmedItems.join("、")}</p>}
              <details className="studio-prompt-context"><summary>查看规划依据</summary><dl className="suite-plan-reference"><dt>文案摘要</dt><dd>{plan.copy || "无"}</dd><dt>画面说明</dt><dd>{plan.visual || "无"}</dd><dt>可见事实</dt><dd>{module.visibleFacts.join("、") || "无"}</dd>{plan.moduleParameters.length > 0 && <><dt>补充参数</dt><dd>{plan.moduleParameters.filter((item) => item.value).map((item) => `${item.key}：${item.value}`).join("；") || "无"}</dd></>}</dl></details>
            </article>;
          })}</div>
        </section>}
        {remoteBatch && !preparing && <details className="studio-task-details suite-batch-section" open={["partially_failed", "failed"].includes(remoteBatch.status)}><summary>批次进度与重试</summary>
          <BatchGenerationStatus batch={remoteBatch} busy={busy} onCancel={() => void cancelBatch()} onRetry={(slotId) => void retrySlot(slotId)} onRetryAll={() => void retryFailedSlots()}
            moduleLabels={Object.fromEntries(plans.map((plan) => [plan.moduleId, plan.title]))}
            onSelect={(assetId) => { const asset = suiteAssets.find((item) => item.id === assetId); if (asset) props.onSelectAsset?.(asset); }} />
          <details className="studio-prompt-context suite-confirmed-prompts"><summary>查看本批次已确认提示词</summary>{remoteBatch.modules.map((module) => <article key={module.id}><strong>{plans.find((plan) => plan.moduleId === module.moduleKey)?.title ?? module.moduleKey}</strong><p>{module.confirmedTaskPrompt}</p></article>)}</details>
        </details>}
        {remotePlan?.status === "confirmed" && !remoteBatch && <p className="suite-loading" role="status">已确认，正在读取生成进度…</p>}
        {<GenerationImageStage key={config.creationMode ?? "professional"}
          images={resultImages}
          activeBatchId={preparing ? undefined : remoteBatch?.id} taskPending={preparing || batchActive}
          source={!remoteBatch ? props.project.assets.find((asset) => asset.id === config.selectedAssetIds[0]) : undefined}
          emptyTitle="准备生成第一组详情套图" onInspect={props.onSelectAsset} onDelete={(asset) => void remove(asset)}
        />}
      </div>
      {awaitingConfirmation && <footer className="suite-generate-strip">
        <div><strong>{plans.length} 个模块 · 共 {total} 张</strong><span>修改保留在当前浏览器，确认后调用生图服务</span></div>
        <Button disabled={busy || !plans.length || plans.some((plan) => !plan.taskPrompt.trim())} onClick={() => void generateImages()}>{busy ? "处理中…" : `确认并生成 ${total} 张`}</Button>
      </footer>}
      {!awaitingConfirmation && !!remoteBatch?.progress.succeeded && <footer className="suite-generate-strip">
        <div><strong>已生成 {remoteBatch.progress.succeeded} / {remoteBatch.progress.total} 张</strong><span>已生成图片保留在项目中，可在画布继续编辑</span></div>
        <Button variant="secondary" onClick={() => void exportSuite()}><Download size={15} />导出整套详情图</Button>
      </footer>}
    </div>
  );


  return (<div className="professional-workspace"><div className="professional-mode-toolbar"><CreationModeSwitch value={config.creationMode} disabled={busy || preparing || batchActive} onChange={creationMode => change({ creationMode })} /></div>
    <GenerationWorkspaceLayout
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      config={<SuiteConfigPanel project={props.project} config={config} planner={modulePlanner} errors={errors} onChange={change} onUpload={upload} onRefresh={props.onRefresh} />}
      footer={<><p className="suite-config-note">{awaitingConfirmation ? "左侧配置用于重新编译；本次张数以右侧方案为准。" : batchActive ? "本批次已锁定，左侧修改用于下一批。" : styleName}</p><GenerationFooter label="编译提示词" disabled={config.creationMode === "regular" && (modulePlanner.planning || !canCompileRegular(config))} countLabel={`共 ${config.selectedModuleIds.length} 张 · 每项一张图`} errors={errors} busy={busy || compiling || !!recovery.error || batchActive || loadingPlan || (remotePlan?.status === "confirmed" && !remoteBatch)} onSubmit={() => void generatePlan()} /></>}
      result={result}
    /></div>
  );
}

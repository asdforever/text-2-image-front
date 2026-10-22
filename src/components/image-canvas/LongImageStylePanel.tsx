import { useEffect, useRef, useState } from "react";
import { createIdempotencyKey, projectApi, projectAssetPreviewUrl, styleHarmonizationApi, suiteApi, type ApiLongImageItem, type ApiProjectAsset, type ApiPromptTemplate, type ApiPromptVersion, type ApiStyleHarmonization, type ApiStyleHarmonizationInput, type ApiStyleHarmonizationTask } from "../../api/client";

const errorText = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试";

export function LongImageStylePanel({ projectId, items, sources, selected, disabled, adopt, refreshed }: {
  projectId: string; items: ApiLongImageItem[]; sources: Array<{ asset: ApiProjectAsset; title: string; url: string }>;
  selected: number[]; disabled: boolean; adopt: (index: number, asset: ApiProjectAsset, sourceAssetId: string) => void; refreshed: () => Promise<void>;
}) {
  const [mode, setMode] = useState<ApiStyleHarmonizationInput["mode"]>("reference");
  const [referenceId, setReferenceId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [templates, setTemplates] = useState<ApiPromptTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [versions, setVersions] = useState<ApiPromptVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  const [jobs, setJobs] = useState<ApiStyleHarmonization[]>([]);
  const [error, setError] = useState("");
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ input: ApiStyleHarmonizationInput; finalPrompt: string } | null>(null);
  const requestKeys = useRef(new Map<string, string>());
  const completed = useRef(new Set<string>());
  const refreshRef = useRef(refreshed); refreshRef.current = refreshed;
  const readJobs = async () => {
    try {
      const result = await styleHarmonizationApi.list(projectId);
      setJobs(result);
      const newFinished = result.filter((job) => !["queued", "generating"].includes(job.status) && !completed.current.has(job.id));
      for (const job of newFinished) completed.current.add(job.id);
      if (newFinished.length) await refreshRef.current();
    } catch (cause) { setError(errorText(cause)); }
  };
  useEffect(() => { void readJobs(); }, [projectId]);
  const running = jobs.some((job) => ["queued", "generating"].includes(job.status));
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void readJobs(); }, 2500);
    return () => window.clearInterval(timer);
  }, [running, projectId]);
  useEffect(() => {
    if (mode !== "prompt") return;
    let cancelled = false; setLoadingPrompts(true);
    suiteApi.listPromptTemplates().then((value) => { if (!cancelled) setTemplates(value.filter((item) => item.executionTarget === "image_model")); }).catch((cause) => { if (!cancelled) setError(errorText(cause)); }).finally(() => { if (!cancelled) setLoadingPrompts(false); });
    return () => { cancelled = true; };
  }, [mode]);
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false; setLoadingPrompts(true); setVersions([]); setVersionId("");
    suiteApi.listPromptTemplateVersions(templateId).then((value) => { if (!cancelled) setVersions(value); }).catch((cause) => { if (!cancelled) setError(errorText(cause)); }).finally(() => { if (!cancelled) setLoadingPrompts(false); });
    return () => { cancelled = true; };
  }, [templateId]);
  const assetIds = [...new Set(selected.map((index) => items[index]?.assetId).filter((id): id is string => !!id))];
  const version = versions.find((item) => item.id === versionId);
  const content = mode === "reference" ? referenceId : mode === "prompt" ? version?.userPromptTemplate.trim() || version?.body || "" : prompt;
  const valid = assetIds.length > 0 && content.trim() && (mode !== "reference" || referenceId) && (mode !== "prompt" || versionId);
  const preview = async () => {
    if (!valid || busy) return;
    const input: ApiStyleHarmonizationInput = { assetIds, mode, ...(mode === "reference" ? { referenceAssetId: referenceId } : mode === "prompt" ? { promptVersionId: versionId } : { prompt }) };
    setBusy(true); setError("");
    try { const result = await styleHarmonizationApi.preview(projectId, input); setConfirm({ input: { ...input, expectedPreviewHash: result.previewHash }, finalPrompt: result.finalPrompt }); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!confirm || busy) return;
    setBusy(true); setError("");
    const fingerprint = JSON.stringify(confirm.input);
    const key = requestKeys.current.get(fingerprint) ?? createIdempotencyKey();
    requestKeys.current.set(fingerprint, key);
    try {
      const job = await styleHarmonizationApi.submit(projectId, confirm.input, key);
      requestKeys.current.delete(fingerprint);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]); setConfirm(null);
      if (!["queued", "generating"].includes(job.status)) await refreshRef.current();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const apply = async (index: number, task: ApiStyleHarmonizationTask) => {
    if (!task.outputAssetId || busy) return;
    setBusy(true); setError("");
    try {
      const assets = await projectApi.listAssets(projectId);
      const candidate = assets.find((asset) => asset.id === task.outputAssetId && asset.state === "available");
      if (!candidate) throw new Error("候选图片暂不可用，请刷新任务后重试");
      adopt(index, candidate, task.sourceAssetId);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  return <section className="lic-style" aria-label="选择性统一风格"><h3>统一所选图片风格 <small>已勾选 {selected.length} 张</small></h3><p className="lic-muted">先勾选需要调整的图片，生成候选后逐张确认采用。</p>
    <fieldset disabled={disabled || busy}><label>统一风格方式<select aria-label="统一风格方式" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="reference">参考图片</option><option value="prompt">提示词版本</option><option value="custom">自写提示词</option></select></label>
      {mode === "reference" && <label>参考图片<select aria-label="风格参考图片" value={referenceId} onChange={(event) => setReferenceId(event.target.value)}><option value="">请选择参考图片</option>{sources.map((source) => <option key={source.asset.id} value={source.asset.id}>{source.title}</option>)}</select></label>}
      {mode === "prompt" && <><label>提示词模板<select aria-label="风格提示词模板" disabled={loadingPrompts} value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">{loadingPrompts ? "加载中…" : "请选择模板"}</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label>提示词版本<select aria-label="风格提示词版本" disabled={loadingPrompts || !templateId} value={versionId} onChange={(event) => setVersionId(event.target.value)}><option value="">请选择具体版本</option>{versions.map((value) => <option key={value.id} value={value.id}>V{value.versionNo} · {value.name}</option>)}</select></label>{version && <pre className="lic-prompt-preview">{content}</pre>}</>}
      {mode === "custom" && <label>自写风格提示词<textarea aria-label="自写风格提示词" maxLength={30000} rows={4} value={prompt} placeholder="例如：柔和暖光、浅米色背景，保持原商品与文字布局" onChange={(event) => setPrompt(event.target.value)} /></label>}
      <button disabled={!valid || loadingPrompts} onClick={preview}>预览风格统一任务</button>
    </fieldset>
    {error && <div className="lic-error" role="alert">{error}<button onClick={() => { setError(""); void readJobs(); }}>刷新风格任务</button></div>}
    {!!jobs.length && <div className="lic-style-jobs"><h3>风格候选 <small>生成后原图仍保留</small></h3>{jobs.map((job) => <section key={job.id} className="lic-style-job"><header><span>{new Date(job.createdAt).toLocaleString("zh-CN")}</span><span>{({ queued: "等待生成", generating: "正在生成", succeeded: "生成完成", partial: "部分完成", failed: "生成失败" })[job.status]}</span></header><details><summary>本次完整提示词</summary><pre className="lic-prompt-preview">{job.finalPrompt}</pre></details>{job.tasks.map((task) => <article key={task.id}><strong>{sources.find((source) => source.asset.id === task.sourceAssetId)?.title ?? task.sourceAsset.filename}</strong>{task.archiveError && <p className="lic-error">{task.archiveError}</p>}{task.outputAssetId && task.status === "succeeded" ? <><div className="lic-candidate-pair"><figure><img src={projectAssetPreviewUrl(projectId, task.sourceAssetId)} alt="风格统一原图" /><figcaption>原图</figcaption></figure><figure><img src={projectAssetPreviewUrl(projectId, task.outputAssetId)} alt="风格统一候选" /><figcaption>候选</figcaption></figure></div>{items.map((item, index) => item.assetId === task.sourceAssetId && <button key={index} aria-label={`采用候选 ${task.id}${items.filter((value) => value.assetId === task.sourceAssetId).length > 1 ? ` 到第 ${index + 1} 张` : ""}`} disabled={disabled} onClick={() => apply(index, task)}>采用到第 {index + 1} 张</button>)}{!items.some((item) => item.assetId === task.sourceAssetId) && <span className="lic-muted">{items.some((item) => item.assetId === task.outputAssetId) ? "已采用到当前长图" : "对应原图不在当前排版中"}</span>}</> : <p className="lic-muted">{task.error ?? (task.status === "queued" ? "等待生成" : "正在生成候选…")}</p>}</article>)}</section>)}</div>}
    {confirm && <div className="lic-confirm-shade"><section className="lic-confirm lic-style-confirm reference-style-confirm" role="alertdialog" aria-busy={busy} aria-modal="true" aria-label="确认风格统一" onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.stopPropagation(); setConfirm(null); } }}><h3>确认风格统一</h3><p>将为勾选的 {confirm.input.assetIds.length} 张图片生成候选，会调用生图服务。生成后需逐张确认采用。</p><ul>{confirm.input.assetIds.map((id) => <li key={id}>{sources.find((source) => source.asset.id === id)?.title ?? id}</li>)}</ul><pre className="lic-prompt-preview">{confirm.finalPrompt}</pre>{error && <p className="lic-error" role="alert">{error}</p>}<div><button autoFocus disabled={busy} onClick={() => setConfirm(null)}>返回调整</button><button className="lic-primary" disabled={busy} onClick={() => void submit()}>{busy ? "提交中…" : "确认生成风格候选"}</button></div></section></div>}
  </section>;
}

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { createIdempotencyKey, projectAssetPreviewUrl, suiteApi, type ApiCanvasRevision, type ApiCanvasTrack, type ApiProjectAsset } from "../../api/client";
import type { GenerationStep } from "./model";

const statusLabel = (status: string) => ({ queued: "等待生成", generating: "生成中", succeeded: "已完成", failed: "失败", partial: "部分完成" }[status] ?? status);

export function CanvasRegenerateDialog({ projectId, step, tracks, assets, close, submitted }: { projectId: string; step: GenerationStep; tracks: ApiCanvasTrack[]; assets: ApiProjectAsset[]; close: () => void; submitted: () => Promise<void> }) {
  const stepId = step.trackId ?? step.id;
  const track = tracks.find((t) => t.stepId === stepId);
  const original: ApiCanvasRevision = { ...step, id: "original", number: 1, status: "succeeded", createdAt: "", outputs: step.outputAssetIds.map((assetId, index) => ({ assetId, index })) };
  const revisions = track?.revisions ?? [original];
  const [baseId, setBaseId] = useState(step.revisionId ?? "original");
  const base = revisions.find((r) => r.id === baseId) ?? original;
  const [prompt, setPrompt] = useState(base.taskPrompt || base.finalPrompt);
  const [sources, setSources] = useState(base.sourceAssetIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof suiteApi.previewCanvasConstraints>> | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const locked = busy || previewBusy;
  const constraints = preview?.constraints ?? base.constraints;
  const canRestore = (["style", "market"] as const).some((key) => {
    const card = base.constraints[key];
    return card?.promptVersionId && card.source === (key === "style" ? "style_description" : "market_guidance");
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const switchBase = (id: string) => { const next = revisions.find((r) => r.id === id); if (!locked && next) { setBaseId(id); setPrompt(next.taskPrompt || next.finalPrompt); setSources(next.sourceAssetIds); setPreview(null); setError(""); } };
  const restoreConstraints = async () => {
    if (locked) return;
    setPreviewBusy(true); setError("");
    try { setPreview(await suiteApi.previewCanvasConstraints(projectId, stepId, baseId)); }
    catch (err) { setError(err instanceof Error ? err.message : "补全失败，请重试"); }
    finally { setPreviewBusy(false); }
  };
  const sourceOptions = (id: string) => {
    let options = [{ id, label: assets.find((a) => a.id === id)?.filename ?? "历史输入图片" }];
    for (const upstream of tracks) for (let index = 0; index < upstream.originalAssetIds.length; index++) {
      const family = upstream.revisions.flatMap((r) => r.outputs.filter((o) => o.index === index).map((o) => ({ id: o.assetId, label: `${upstream.title} · V${r.number} · 第 ${index + 1} 张` })));
      if (family.some((o) => o.id === id)) options = family;
    }
    return options.filter((o) => assets.some((a) => a.id === o.id && a.state === "available"));
  };
  const running = track?.revisions.some((r) => ["queued", "generating"].includes(r.status));
  const fullPrompt = ["hero", "suite", "detail"].includes(base.kind) ? [
    ...([["authenticity", "商品真实性约束"], ["market", "具体电商平台约束"], ["style", "全局风格约束"]] as const).flatMap(([key, label]) => constraints[key]?.content ? [`[${label}]\n${constraints[key].content}`] : []), `[实时任务提示词]\n${prompt.trim()}`,
  ].join("\n\n") : prompt.trim();
  const submit = async () => {
    if (locked || !prompt.trim() || running) return;
    setBusy(true); setError("");
    const body = { stepId, baseRevisionId: baseId, taskPrompt: prompt, sourceAssetIds: sources, ...(preview ? { restoredConstraintsHash: preview.constraintsHash } : {}) };
    const payload = JSON.stringify(body);
    if (request.current?.payload !== payload) request.current = { payload, key: createIdempotencyKey() };
    try { await suiteApi.regenerateCanvas(projectId, body, request.current!.key); await submitted(); close(); }
    catch (err) { setError(err instanceof Error ? err.message : "提交失败，请重试"); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="ic-generation-dialog ic-regenerate-dialog reference-editor" aria-label="迭代生成" aria-busy={locked} onCancel={(event) => { if (locked) event.preventDefault(); else close(); }}>
    <header><div><small>提示词与图片版本</small><h2>{step.title}</h2></div><button aria-label="关闭迭代生成" disabled={locked} onClick={close}><X size={18} /></button></header>
    <div className="ic-generation-detail-body">
      <label className="ic-version-field">基于提示词版本<select aria-label="提示词版本" value={baseId} disabled={locked} onChange={(e) => switchBase(e.target.value)}>{revisions.map((r) => <option key={r.id} value={r.id}>V{r.number} · {statusLabel(r.status)}</option>)}</select></label>
      <section><h3>上游输入图片</h3><div className="ic-regenerate-sources">{base.sourceAssetIds.map((id, i) => <div key={`${baseId}-${i}`}><img src={projectAssetPreviewUrl(projectId, sources[i])} alt={`上游输入 ${i + 1}`} /><select aria-label={`上游输入版本 ${i + 1}`} value={sources[i]} disabled={busy} onChange={(event) => setSources(sources.map((s, index) => index === i ? event.target.value : s))}>{sourceOptions(id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>)}</div><p className="ic-note">从以上输入重新生成。切换上游版本需在此明确选择，下游不会自动重新生成。</p></section>
      {(constraints.style?.content || constraints.market?.content) && <section className="ic-frozen-constraints"><h3>{preview ? "本次生成使用的完整约束" : "沿用的约束"}</h3>{constraints.style?.content && <p><b>风格：</b>{constraints.style.content}</p>}{constraints.market?.content && <p><b>平台：</b>{constraints.market.content}</p>}
        {canRestore && <div className="ic-constraint-restore"><p className="ic-note">{preview ? "已补全当时绑定版本的正文，确认生成后用于新版本。历史记录保持不变。" : "此历史版本使用了简短说明，未带入已绑定的完整提示词。可先补全预览，再确认生成。"}</p>
          {preview ? <button disabled={locked} onClick={() => { setPreview(null); setError(""); }}>恢复历史约束</button> : <button disabled={locked} onClick={() => void restoreConstraints()}>{previewBusy ? "正在读取完整提示词…" : "补全已绑定提示词"}</button>}
        </div>}
      </section>}
      <section><label className="ic-version-field">本次任务提示词<textarea aria-label="本次任务提示词" value={prompt} maxLength={30000} disabled={busy} onChange={(event) => setPrompt(event.target.value)} rows={7} /></label></section>
      <details className="ic-prompt-preview"><summary>预览最终发送的提示词</summary><pre>{fullPrompt}</pre></details>
      <p className="ic-note">本次生成 {track?.originalAssetIds.length ?? step.outputAssetIds.length} 张。成功后更新当前图片，旧版本保留；失败时继续使用旧图。</p>
      {base.errors?.map((item, i) => <p className="ic-error" key={i}>{item.message}</p>)}
      {error && <p className="ic-error" role="alert">{error}</p>}
      {running && <p role="status">此步骤正在生成，完成后可以继续迭代。</p>}
    </div>
    <footer><button disabled={locked} onClick={close}>取消</button><button className="ic-primary" disabled={locked || running || !prompt.trim() || sources.some((id) => !assets.some((a) => a.id === id && a.state === "available"))} onClick={() => void submit()}>{busy ? <Loader2 size={15} className="ic-spin" /> : <Sparkles size={15} />}确认生成新版本</button></footer>
  </dialog>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Images, Plus, X } from "lucide-react";
import { createIdempotencyKey, longImageApi, type ApiLongImage, type ApiLongImageItem, type ApiLongImageRecipe, type ApiProjectAsset, type ApiWorkbench } from "../../api/client";
import { longImageLayout, longImageSources, newLongImageItem } from "./long-image-model";
import "./long-image.css";
import { LongImageStylePanel } from "./LongImageStylePanel";
import { LongImagePlanningAdvice } from "./LongImagePlanningAdvice";

const initialRecipe = (): ApiLongImageRecipe => ({ title: "详情长图", width: 750, gap: 0, background: "#ffffff", items: [] });
const messageOf = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试";
const cropLabels = { top: "上", right: "右", bottom: "下", left: "左" } as const;

export function LongImageComposer({ projectId, assets, workbench, close, saved }: {
  projectId: string; assets: ApiProjectAsset[]; workbench: ApiWorkbench; close: () => void; saved: () => Promise<void>;
}) {
  const [recipe, setRecipe] = useState(initialRecipe);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialRecipe()));
  const [records, setRecords] = useState<ApiLongImage[]>([]);
  const [active, setActive] = useState<ApiLongImage | null>(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [query, setQuery] = useState("");
  const [sliceHeight, setSliceHeight] = useState(2000);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [styleSelected, setStyleSelected] = useState<number[]>([]);
  const [candidateAssets, setCandidateAssets] = useState<ApiProjectAsset[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestKeys = useRef(new Map<string, string>());
  const dragIndex = useRef<number | null>(null);
  // Browsers apply EXIF orientation when decoding; persisted source dimensions may not.
  const orientedAssets = useMemo(() => [...assets, ...candidateAssets.filter((candidate) => !assets.some((asset) => asset.id === candidate.id))].map((asset) => ({ ...asset, ...dimensions[asset.id] })), [assets, candidateAssets, dimensions]);
  const sources = useMemo(() => longImageSources(workbench, orientedAssets), [workbench, orientedAssets]);
  const layout = useMemo(() => longImageLayout(recipe, orientedAssets), [recipe, orientedAssets]);
  const fingerprint = JSON.stringify(recipe);
  const dirty = fingerprint !== baseline;
  const downloadable = active && fingerprint === JSON.stringify(active.recipe);
  const selectedFailure = recipe.items.some((item) => failedImages.includes(item.assetId));
  const selectedIds = [...new Set(recipe.items.map((item) => item.assetId))].join("\n");
  const loadingImages = recipe.items.some((item) => !dimensions[item.assetId] && orientedAssets.some((asset) => asset.id === item.assetId && asset.state === "available"));
  useEffect(() => {
    let cancelled = false;
    for (const assetId of selectedIds.split("\n").filter(Boolean)) {
      const source = sources.find((item) => item.asset.id === assetId);
      if (!source) continue;
      const image = new Image();
      image.onload = () => { if (!cancelled) { setDimensions((current) => ({ ...current, [assetId]: { width: image.naturalWidth, height: image.naturalHeight } })); setFailedImages((current) => current.filter((id) => id !== assetId)); } };
      image.onerror = () => { if (!cancelled) setFailedImages((current) => current.includes(assetId) ? current : [...current, assetId]); };
      image.src = source.url;
    }
    return () => { cancelled = true; };
  }, [selectedIds, projectId]);
  const loadRecords = async () => {
    try { setRecords(await longImageApi.list(projectId)); setListError(""); }
    catch (cause) { setListError(messageOf(cause)); }
  };
  useEffect(() => { void loadRecords(); }, [projectId]);
  const attemptClose = () => { if (busy || downloading) return; if (dirty) setPendingAction(() => close); else close(); };
  const closeRef = useRef(attemptClose);
  closeRef.current = attemptClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      const nested = dialogRef.current?.querySelector<HTMLElement>('[role="alertdialog"]');
      if (event.key === "Escape" && !nested) { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const focusables = (nested ?? dialogRef.current)?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]');
      if (!focusables?.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("keydown", key, true); previous?.focus(); };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  const changeItem = (index: number, update: Partial<ApiLongImageItem>) => setRecipe((current) => ({ ...current, items: current.items.map((item, position) => position === index ? { ...item, ...update } : item) }));
  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || from >= recipe.items.length || to >= recipe.items.length || from === to) return;
    setStyleSelected((current) => current.map((index) => index === from ? to : from < to && index > from && index <= to ? index - 1 : from > to && index >= to && index < from ? index + 1 : index));
    setRecipe((current) => {
    if (from < 0 || to < 0 || from >= current.items.length || to >= current.items.length || from === to) return current;
    const items = [...current.items]; items.splice(to, 0, items.splice(from, 1)[0]); return { ...current, items };
    });
  };
  const remove = (index: number) => {
    setRecipe({ ...recipe, items: recipe.items.filter((_, position) => position !== index) });
    setStyleSelected((current) => current.filter((position) => position !== index).map((position) => position > index ? position - 1 : position));
  };
  const restore = (id: string) => {
    const record = records.find((item) => item.assetId === id) ?? null;
    const apply = () => { const next = record ? structuredClone(record.recipe) : initialRecipe(); setRecipe(next); setStyleSelected([]); setBaseline(JSON.stringify(next)); setActive(record); setError(""); };
    if (dirty) setPendingAction(() => apply); else apply();
  };
  const save = async () => {
    if (busy || layout.errors.length || selectedFailure || loadingImages) return;
    setBusy(true); setError("");
    const key = requestKeys.current.get(fingerprint) ?? createIdempotencyKey();
    requestKeys.current.set(fingerprint, key);
    try {
      const result = await longImageApi.save(projectId, recipe, key);
      setRecords((current) => [result, ...current.filter((item) => item.assetId !== result.assetId)]);
      setActive(result); setRecipe(result.recipe); setBaseline(JSON.stringify(result.recipe));
      try { await saved(); } catch { setError("长图已保存，画布图片暂未刷新，请稍后刷新画布"); }
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusy(false); }
  };
  const download = async (sliced: boolean) => {
    if (!active || !downloadable || downloading) return;
    setDownloading(true); setError("");
    try {
      const blob = await longImageApi.download(projectId, active.assetId, sliced ? sliceHeight : undefined);
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `${active.title.replace(/[<>:"/\\|?*]/g, "_")}${sliced ? "-切片.zip" : ".png"}`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setDownloading(false); }
  };
  return <div className="lic-overlay"><div className="lic-dialog" role="dialog" aria-modal="true" aria-label="制作长图" tabIndex={-1} ref={dialogRef}>
    <header className="lic-header"><div><h2>制作长图</h2><p>挑选满意的版本，排成完整详情页</p></div><button aria-label="关闭长图制作" disabled={busy || downloading} onClick={attemptClose}><X size={20} /></button></header>
    <div className="lic-body">
      <div className="lic-editor">
        <label className="lic-records">已保存方案<select aria-label="已保存方案" disabled={busy} value={active?.assetId ?? ""} onChange={(event) => restore(event.target.value)}><option value="">新建长图</option>{records.map((record) => <option key={record.assetId} value={record.assetId}>{record.title} · {record.width} × {record.height}</option>)}</select></label>
        {listError && <div className="lic-error" role="alert">方案列表加载失败：{listError}<button onClick={() => void loadRecords()}>重试加载方案</button></div>}
        <fieldset disabled={busy} className="lic-fields"><legend>整体排版</legend>
          <label className="lic-title">长图名称<input aria-label="长图名称" maxLength={80} value={recipe.title} onChange={(event) => setRecipe({ ...recipe, title: event.target.value })} /></label>
          <label>输出宽度 · px<input aria-label="输出宽度" type="number" min={320} max={1600} step={1} value={recipe.width} onChange={(event) => setRecipe({ ...recipe, width: Number(event.target.value) })} /></label>
          <label>图片间距 · px<input aria-label="图片间距" type="number" min={0} max={200} step={1} value={recipe.gap} onChange={(event) => setRecipe({ ...recipe, gap: Number(event.target.value) })} /></label>
          <label>背景颜色<input aria-label="背景颜色" type="color" value={recipe.background} onChange={(event) => setRecipe({ ...recipe, background: event.target.value })} /></label>
        </fieldset>
        <LongImagePlanningAdvice projectId={projectId} />
        <section className="lic-sources" aria-label="选择图片版本"><h3>选择图片版本 <small>可选同一模块的多张图片</small></h3><input aria-label="搜索可选图片" placeholder="搜索模块、版本或文件名" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="lic-source-grid">{sources.filter((source) => source.title.toLowerCase().includes(query.toLowerCase())).map((source) => <button key={source.asset.id} disabled={busy || recipe.items.length >= 20} aria-label={`添加 ${source.title}`} onClick={() => setRecipe({ ...recipe, items: [...recipe.items, newLongImageItem(source.asset.id)] })}><img src={source.url} alt="" loading="lazy" onError={() => setFailedImages((current) => current.includes(source.asset.id) ? current : [...current, source.asset.id])} /><span>{source.title}<small>{source.asset.width} × {source.asset.height}</small></span><Plus size={16} /></button>)}</div>
          {!sources.length && <p className="lic-muted">项目暂无可用图片，请先返回项目上传或生成图片。</p>}
        </section>
        <section aria-label="已选图片" className="lic-selected"><h3>已选图片 <small>{recipe.items.length} / 20 · 拖动或使用箭头排序</small></h3>
          {!recipe.items.length && <p className="lic-muted">从上方添加图片，默认保留完整画面。</p>}
          {recipe.items.map((item, index) => {
            const source = sources.find((value) => value.asset.id === item.assetId);
            return <article className="lic-item" data-long-item={index} key={`${index}:${item.assetId}`} draggable={!busy} onDragStart={(event) => { dragIndex.current = index; event.dataTransfer.setData("text/plain", String(index)); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { dragIndex.current = null; }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); if (!busy && dragIndex.current !== null) move(dragIndex.current, index); dragIndex.current = null; }}>
              <header><button className="lic-drag" draggable={!busy} disabled={busy} aria-label={`拖动第 ${index + 1} 张排序`}><GripVertical size={15} /></button><span>{index + 1}. {source?.title ?? "来源图片不可用"}</span><button aria-label={`上移第 ${index + 1} 张`} disabled={busy || index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={15} /></button><button aria-label={`下移第 ${index + 1} 张`} disabled={busy || index === recipe.items.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={15} /></button><button aria-label={`移除第 ${index + 1} 张`} disabled={busy} onClick={() => remove(index)}><X size={15} /></button></header>
              <label className="lic-style-check"><input type="checkbox" aria-label={`统一第 ${index + 1} 张风格`} disabled={busy || !source} checked={styleSelected.includes(index)} onChange={(event) => setStyleSelected((current) => event.target.checked ? [...current, index] : current.filter((value) => value !== index))} />统一此图风格</label>
              <fieldset disabled={busy}><legend>裁剪 · %</legend><div className="lic-crop-fields">{(Object.keys(cropLabels) as Array<keyof typeof cropLabels>).map((side) => <label key={side}>{cropLabels[side]}<input aria-label={`第 ${index + 1} 张${cropLabels[side]}裁剪`} type="number" min={0} max={45} step={1} value={item.crop[side]} onChange={(event) => changeItem(index, { crop: { ...item.crop, [side]: Number(event.target.value) } })} /></label>)}</div><div className="lic-padding-fields"><label>上留白 · px<input aria-label={`第 ${index + 1} 张上留白`} type="number" min={0} max={200} step={1} value={item.paddingTop} onChange={(event) => changeItem(index, { paddingTop: Number(event.target.value) })} /></label><label>下留白 · px<input aria-label={`第 ${index + 1} 张下留白`} type="number" min={0} max={200} step={1} value={item.paddingBottom} onChange={(event) => changeItem(index, { paddingBottom: Number(event.target.value) })} /></label></div></fieldset>
            </article>;
          })}
        </section>
        <LongImageStylePanel projectId={projectId} items={recipe.items} sources={sources} selected={styleSelected} disabled={busy} refreshed={saved} adopt={(index, asset, sourceAssetId) => { setCandidateAssets((current) => [...current.filter((value) => value.id !== asset.id), asset]); setRecipe((current) => ({ ...current, items: current.items.map((item, position) => position === index && item.assetId === sourceAssetId ? { ...item, assetId: asset.id } : item) })); setStyleSelected((current) => current.filter((value) => value !== index)); }} />
      </div>
      <section className="lic-preview-panel" aria-label="长图预览"><header><h3>实时预览</h3><span>{recipe.width} × {layout.height} px</span></header>
        <div className="lic-preview-scroll">{!recipe.items.length ? <div className="lic-empty"><Images size={40} /><p>从左侧选择图片开始排版</p><small>完整保留 · 等比缩放</small></div> : loadingImages && !selectedFailure ? <div className="lic-empty"><p>正在读取图片尺寸…</p></div> : layout.errors.length ? <div className="lic-empty"><p>请调整左侧参数后预览</p></div> : <svg className="lic-preview" role="img" aria-label={`长图预览 ${recipe.width} × ${layout.height}`} viewBox={`0 0 ${recipe.width} ${layout.height}`} style={{ background: recipe.background }}>
          {layout.segments.map((segment, index) => {
            const source = sources.find((value) => value.asset.id === segment.assetId)!;
            return <svg key={`${index}:${segment.assetId}`} x={0} y={segment.top} width={recipe.width} height={segment.height} viewBox={`${segment.x} ${segment.y} ${segment.cropWidth} ${segment.cropHeight}`} preserveAspectRatio="none" overflow="hidden"><image href={source.url} width={source.asset.width} height={source.asset.height} preserveAspectRatio="none" /></svg>;
          })}
        </svg>}</div>
        <div className="lic-preview-notes">{layout.errors.map((message) => <p key={message} className="lic-validation">{message}</p>)}{layout.warnings.map((message) => <p key={message}>{message}</p>)}{selectedFailure && <p className="lic-validation">来源图片加载失败，请移除或刷新项目后重新选择。</p>}<p>裁剪会去掉边缘内容，请检查文字与主体是否完整。</p></div>
      </section>
    </div>
    <footer className="lic-footer">{error && <div className="lic-error" role="alert">{error}</div>}
      {downloadable && <div className="lic-downloads"><span className="lic-success"><Check size={14} />已保存到项目和成品库</span><button disabled={downloading} onClick={() => void download(false)}>下载整图 PNG</button><label>切片高度<input aria-label="切片高度" type="number" min={256} max={10000} step={1} value={sliceHeight} onChange={(event) => setSliceHeight(Number(event.target.value))} /></label><button disabled={downloading || !Number.isInteger(sliceHeight) || sliceHeight < 256 || sliceHeight > 10000} onClick={() => void download(true)}>下载切片 ZIP</button></div>}
      <div className="lic-footer-actions"><span>{busy ? "正在拼接并保存…" : downloadable ? "可恢复方案并调整后另存" : "保存为新图片，来源版本保留"}</span><button className="lic-primary" disabled={busy || downloading || loadingImages || !!layout.errors.length || selectedFailure || !!downloadable} onClick={() => void save()}>{busy ? "保存中…" : active ? "另存新长图" : "保存并归档"}</button></div>
    </footer>
    {pendingAction && <div className="lic-confirm-shade"><section role="alertdialog" aria-modal="true" aria-label="放弃未保存排版" className="lic-confirm" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setPendingAction(null); } }}><h3>排版尚未保存</h3><p>放弃修改后，本次选图与排版将丢失。</p><div><button autoFocus onClick={() => setPendingAction(null)}>继续编辑</button><button onClick={() => { const action = pendingAction; setPendingAction(null); action(); }}>放弃修改</button></div></section></div>}
  </div></div>;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { suiteApi, type ApiImageEditSession, type ApiSuiteTask, type ApiTaskVersion } from "../../api/client";
import { Icon } from "../../pages/shared";
import { cropForRatio, draftFromOperation, initialDraft, isSupportedOperation, operationFromDraft, validateDraft, type DraftOperation, type EditorDraft, type EditTool, type MaskStroke, type Region } from "./image-editor-model";
import "./image-editor.css";

type Document = { draft: EditorDraft; operations: DraftOperation[] };
type Point = { x: number; y: number };
type StageEvent = { target: { getStage(): Konva.Stage | null } };
const tools: [EditTool, string, string][] = [["prompt_edit", "描述修改", "promptEdit"], ["add_text", "添加文本", "addText"], ["change_text", "改文字", "changeText"], ["inpaint", "局部重绘", "redraw"], ["crop_resize", "裁剪与尺寸", "cropResize"]];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试";

export function ImageEditorModal({ task, version, onClose, onSubmit }: { task: ApiSuiteTask; version: ApiTaskVersion; onClose: () => void; onSubmit: (spec: Record<string, unknown>, instruction: string) => Promise<void>; onRegenerate?: () => Promise<void> }) {
  const initial = (): Document => ({ draft: initialDraft(version.width, version.height), operations: [] });
  const [history, setHistory] = useState<{ past: Document[]; present: Document; future: Document[] }>(() => ({ past: [], present: initial(), future: [] }));
  const documentRef = useRef(history.present);
  const { draft, operations } = history.present;
  const [session, setSession] = useState<ApiImageEditSession | null>(null);
  const sessionRef = useRef<ApiImageEditSession | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showMask, setShowMask] = useState(true);
  const [maskMode, setMaskMode] = useState<"draw" | "erase">("draw");
  const [brush, setBrush] = useState(36);
  const [activeStroke, setActiveStroke] = useState<MaskStroke | null>(null);
  const activeStrokeRef = useRef<MaskStroke | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const regionStart = useRef<Point | null>(null);
  const regionRef = useRef<Region | null>(null);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 1, height: 1 });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<Konva.Group | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const toolDrafts = useRef<Partial<Record<EditTool, EditorDraft>>>({});
  const [ocrBusy, setOcrBusy] = useState(false);

  const update = (next: Document, record = true) => {
    documentRef.current = next;
    setHistory(current => ({ past: record ? [...current.past, current.present].slice(-80) : current.past, present: next, future: record ? [] : current.future }));
  };
  const patch = (changes: Partial<EditorDraft>) => update({ ...documentRef.current, draft: { ...documentRef.current.draft, ...changes } });
  const undo = () => setHistory(current => {
    if (!current.past.length) return current;
    const present = current.past[current.past.length - 1]; documentRef.current = present;
    return { past: current.past.slice(0, -1), present, future: [current.present, ...current.future] };
  });
  const redo = () => setHistory(current => {
    if (!current.future.length) return current;
    const present = current.future[0]; documentRef.current = present;
    return { past: [...current.past, current.present], present, future: current.future.slice(1) };
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [result, sessions] = await Promise.all([suiteApi.imageEditorCapabilities(), suiteApi.listImageEditSessions(task.suiteId)]);
        const saved = sessions.find(item => item.sourceVersionId === version.id && item.status === "draft");
        const current = saved ?? await suiteApi.createImageEditSession(task.suiteId, version.id);
        if (cancelled) return;
        sessionRef.current = current; setSession(current); setCapabilities(result.capabilities);
        const restored = { draft: initialDraft(version.width, version.height), operations: (current.operations ?? []) as DraftOperation[] };
        documentRef.current = restored; setHistory({ past: [], present: restored, future: [] });
      } catch (value) { if (!cancelled) setError(errorMessage(value)); }
    };
    void load(); return () => { cancelled = true; };
  }, [task.suiteId, version.id, version.width, version.height]);

  const updateFrame = useCallback(() => {
    const image = imageRef.current, container = canvasRef.current;
    if (!image || !container) return;
    const a = image.getBoundingClientRect(), b = container.getBoundingClientRect();
    if (a.width && a.height) setFrame({ left: a.left-b.left, top: a.top-b.top, width: a.width, height: a.height });
  }, []);
  useEffect(() => { const observer = new ResizeObserver(updateFrame); if (canvasRef.current) observer.observe(canvasRef.current); if (imageRef.current) observer.observe(imageRef.current); updateFrame(); return () => observer.disconnect(); }, [updateFrame]);
  useEffect(() => { transformerRef.current?.nodes(textRef.current && !showOriginal ? [textRef.current] : []); }, [draft.tool, draft.id, draft.text, draft.newText, showOriginal]);
  const available = (tool: EditTool) => tool === "none" || capabilities?.[tools.find(([value]) => value === tool)?.[2] ?? ""] === true || (tool === "inpaint" && capabilities?.erase === true);
  const stageDraft = (current: Document) => {
    if (validateDraft(current.draft)) return current.operations;
    const item = operationFromDraft(current.draft, version.id);
    return [...current.operations.filter(old => old.operationId !== item.operationId && !(item.type === "crop_resize" && old.type === "crop_resize")), item];
  };
  const editOperation = (item: DraftOperation) => {
    const current = documentRef.current;
    if (current.draft.id === item.operationId) return;
    const nextOperations = stageDraft(current);
    toolDrafts.current[current.draft.tool] = current.draft;
    const nextDraft = draftFromOperation(item, version.width, version.height);
    toolDrafts.current[nextDraft.tool] = nextDraft;
    update({ draft: nextDraft, operations: nextOperations });
    setShowOriginal(false); setError("");
  };
  const choose = (tool: EditTool) => {
    const current = documentRef.current;
    toolDrafts.current[current.draft.tool] = current.draft;
    const nextOperations = stageDraft(current);
    const existing = nextOperations.find(item => item.type === tool || (tool === "inpaint" && ["redraw", "erase"].includes(item.type)));
    const next = toolDrafts.current[tool] ?? (existing ? draftFromOperation(existing, version.width, version.height) : { ...initialDraft(version.width, version.height), tool, prompt: tool === "change_text" ? "保持原有排版、字体感觉、颜色、透视和光影，只替换文字内容" : "", action: tool === "inpaint" && !capabilities?.redraw ? "erase" as const : "redraw" as const });
    update({draft:next,operations:nextOperations}); setError(""); setShowOriginal(false);
  };
  const position = (event: StageEvent): Point => {
    const point = event.target.getStage()?.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(1, point.x / frame.width)), y: Math.max(0, Math.min(1, point.y / frame.height)) };
  };
  const start = (event: StageEvent) => {
    if (saving || showOriginal) return;
    const point = position(event);
    if (draft.tool === "inpaint") {
      setShowMask(true);
      const stroke = { mode: maskMode, points: [point], width: brush / Math.min(frame.width, frame.height) };
      activeStrokeRef.current = stroke; setActiveStroke(stroke);
    } else if (["change_text", "crop_resize"].includes(draft.tool) && event.target === event.target.getStage()) {
      regionStart.current = point; regionRef.current = null;
    }
  };
  const move = (event: StageEvent) => {
    const point = position(event); setPointer(point);
    if (activeStrokeRef.current) { const next = { ...activeStrokeRef.current, points: [...activeStrokeRef.current.points, point] }; activeStrokeRef.current = next; setActiveStroke(next); }
    if (regionStart.current) {
      const p = regionStart.current, next = { x: Math.min(p.x,point.x), y: Math.min(p.y,point.y), width: Math.abs(point.x-p.x), height: Math.abs(point.y-p.y), rotation: 0 };
      regionRef.current = next; setActiveRegion(next);
    }
  };
  const finish = () => {
    if (activeStrokeRef.current) patch({ strokes: [...documentRef.current.draft.strokes, activeStrokeRef.current] });
    const r = regionRef.current;
    if (r && r.width*frame.width > 3 && r.height*frame.height > 3) {
      if (draft.tool === "crop_resize") patch({ crop: r, width: Math.max(1, Math.round(r.width*version.width)), height: Math.max(1, Math.round(r.height*version.height)) });
      else patch({ region: r });
    }
    activeStrokeRef.current = null; regionStart.current = null; regionRef.current = null;
    setActiveStroke(null); setActiveRegion(null);
  };
  const updateTextRegion = (node: Konva.Group) => {
    const width = Math.min(1, Math.max(.01, node.width()*node.scaleX()/frame.width)), height = Math.min(1, Math.max(.01, node.height()*node.scaleY()/frame.height));
    node.scaleX(1); node.scaleY(1);
    patch({ region: { x: Math.max(0,Math.min(1-width,node.x()/frame.width)), y: Math.max(0,Math.min(1-height,node.y()/frame.height)), width, height, rotation: Math.max(-360,Math.min(360,node.rotation())) } });
  };
  const addTextBox = () => {
    const current = documentRef.current;
    const nextOperations = stageDraft(current);
    const nextDraft = { ...initialDraft(version.width, version.height), tool: "add_text" as const };
    toolDrafts.current.add_text = nextDraft;
    update({ draft: nextDraft, operations: nextOperations });
  };

  // 会话修订号只从前一次成功写入的结果读取，保存和提交不会并发抢版本。
  const sync = (next: DraftOperation[]) => {
    const save = queue.current.catch(() => undefined).then(async () => {
      let current = sessionRef.current; if (!current) throw new Error("图片编辑会话尚未就绪");
      for (const old of (current.operations ?? []) as DraftOperation[]) {
        if (!next.some(item => item.operationId === old.operationId)) {
          current = await suiteApi.removeImageEditOperation(current.id, old.operationId, current.revision); sessionRef.current = current; setSession(current);
        }
      }
      for (const item of next) {
        const existing = (current.operations ?? []).find(old => (old as DraftOperation).operationId === item.operationId);
        if (JSON.stringify(existing) !== JSON.stringify(item)) {
          current = await suiteApi.upsertImageEditOperation(current.id, item as unknown as Record<string, unknown>, item.summary, current.revision); sessionRef.current = current; setSession(current);
        }
      }
    });
    queue.current = save; return save;
  };
  const collect = () => {
    const current = documentRef.current;
    if (current.draft.tool === "none") return current.operations;
    const issue = validateDraft(current.draft); if (issue) throw new Error(issue);
    const item = operationFromDraft(current.draft, version.id);
    return [...current.operations.filter(old => old.operationId !== item.operationId && !(item.type === "crop_resize" && old.type === "crop_resize")), item];
  };
  const save = async (submit = false) => {
    if (saving || !session) return;
    setSaving(true); setError("");
    try {
      let next = collect();
      if (submit) {
        if (!next.length) throw new Error("请先添加修改");
        if (next.some(item => !isSupportedOperation(item))) throw new Error("请先移除旧工具操作，再确认生成");
        next = next.map(item => {
          const restored = draftFromOperation(item, version.width, version.height);
          const issue = validateDraft(restored); if (issue) throw new Error(item.summary + "：" + issue);
          return operationFromDraft(restored, version.id);
        });
      }
      update({ ...documentRef.current, operations: next });
      await sync(next);
      if (submit) await onSubmit({ schemaVersion: "image-edit-v2", sessionId: sessionRef.current!.id, sourceVersionId: version.id, operations: next }, next.map(item => item.summary).join("；"));
    } catch (value) { setError(errorMessage(value)); } finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    for (const tool of Object.keys(toolDrafts.current) as EditTool[]) if (toolDrafts.current[tool]?.id === id) delete toolDrafts.current[tool];
    const next = operations.filter(item => item.operationId !== id);
    update({ draft: draft.id === id ? initialDraft(version.width, version.height) : draft, operations: next });
    setSaving(true); setError("");
    try { await sync(next); } catch (value) { setError(errorMessage(value)); } finally { setSaving(false); }
  };
  const recognize = async () => {
    if (!session || !capabilities?.ocr) return;
    setOcrBusy(true);
    try { const result = await suiteApi.recognizeImageEditText(session.id, version.id); const block = result.blocks[0]; if (block) patch({ originalText: block.text, region: { ...block.bounds, rotation: block.rotation } }); else setError("未识别到文字，请手工框选并输入原文字"); }
    catch { setError("识别失败，请手工框选并输入原文字"); } finally { setOcrBusy(false); }
  };
  const resize = (key: "width" | "height", value: number) => {
    const ratio = draft.crop.width * version.width / (draft.crop.height * version.height);
    patch(draft.lockRatio ? { [key]: value, [key === "width" ? "height" : "width"]: Math.max(1, Math.round(key === "width" ? value/ratio : value*ratio)) } : { [key]: value });
  };
  const selectRatio = (value: string) => { const crop = cropForRatio(value, version.width, version.height); patch({ crop, width: Math.round(version.width*crop.width), height: Math.round(version.height*crop.height) }); };
  const textVisible = ["add_text", "change_text"].includes(draft.tool);
  const displayRegion = activeRegion ?? (draft.tool === "crop_resize" ? draft.crop : draft.region);
  const showLocal = !showOriginal;
  const activeOperation = draft.tool !== "none" ? operationFromDraft(draft, version.id) : null;
  const pending = activeOperation && JSON.stringify(operations.find(item => item.operationId === draft.id)) !== JSON.stringify(activeOperation);
  const newEdits = JSON.stringify(operations) !== JSON.stringify(session?.operations ?? []);
  const needsModel = operations.some(item => item.type !== "crop_resize") || (draft.tool !== "none" && draft.tool !== "crop_resize");
  const previewSize = (region: Region, value: string) => Math.max(12, Math.min(22, region.height * frame.height * .42, region.width * frame.width / Math.max(4, [...value].length) * 1.5));
  const cropRatio = draft.crop.width === 1 && draft.crop.height === 1 ? "original" : ["1:1","3:4","4:3","9:16","16:9"].find(value => { const [a,b] = value.split(":").map(Number); return Math.abs(draft.crop.width*version.width/(draft.crop.height*version.height)-a/b)<.001; }) ?? "custom";

  return <div className="wb-editor-backdrop reference-editor-backdrop" role="presentation">
    <section className="wb-editor-modal ie-core reference-editor" role="dialog" aria-modal="true" aria-label="图片编辑器" aria-busy={saving}>
      <header className="wb-editor-head"><div><strong>{task.title}</strong><small>基于版本 v{version.versionNumber}，原图保留，修改结果单独保存</small></div><button type="button" aria-label="关闭图片编辑器" disabled={saving} onClick={onClose}><Icon name="x" /></button></header>
      <div className="wb-editor-body">
        <aside className="wb-editor-tools"><strong>编辑工具</strong>{tools.map(([tool,label]) => <button key={tool} type="button" aria-pressed={draft.tool === tool} className={draft.tool === tool ? "is-active" : ""} disabled={saving || !session || !available(tool)} onClick={() => choose(tool)}>{label}<small>{!capabilities ? "检查中" : available(tool) ? "可用" : "不可用"}</small></button>)}<p>{draft.tool === "prompt_edit" ? "直接描述希望如何修改，当前图片会与修改要求一起交给模型，无需涂选区域。" : draft.tool === "inpaint" ? "涂选要修改的区域，区域外保留原图。消除内容也在这里操作。" : draft.tool === "change_text" ? "在图上框选文字，再填写替换内容。" : draft.tool === "crop_resize" ? "在图上框选，或选择比例。裁剪与缩放不调用生图模型。" : "文字与局部修改会生成新图片，原图不会被覆盖。"}</p></aside>
        <div className="wb-editor-stage">
          <div className="ie-preview-tools"><button type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? "返回编辑" : "查看原图"}</button>{draft.tool === "inpaint" && <button type="button" aria-pressed={showMask} onClick={() => setShowMask(!showMask)}>{showMask ? "隐藏选区" : "显示选区"}</button>}<span>{showOriginal ? "原图对照中" : "编辑范围预览 · AI 效果以生成结果为准"}</span></div>
          <div className="wb-editor-canvas" ref={canvasRef}>
            <img ref={imageRef} onLoad={updateFrame} src={version.previewUrl} alt={task.title} draggable={false} />
            <Stage width={frame.width} height={frame.height} style={{ position: "absolute", left: frame.left, top: frame.top, touchAction: "none" }} onMouseDown={start} onMouseMove={move} onMouseUp={finish} onMouseLeave={() => { setPointer(null); finish(); }} onTouchStart={start} onTouchMove={move} onTouchEnd={finish}>
              <Layer visible={showLocal && draft.tool === "inpaint" && showMask} listening={false}>
                {[...draft.strokes, ...(activeStroke ? [activeStroke] : [])].map((stroke,index) => <Line key={index} points={stroke.points.length === 1 ? [stroke.points[0].x*frame.width,stroke.points[0].y*frame.height,stroke.points[0].x*frame.width+.01,stroke.points[0].y*frame.height+.01] : stroke.points.flatMap(p => [p.x*frame.width,p.y*frame.height])} stroke="#df5252" opacity={.55} strokeWidth={stroke.width*Math.min(frame.width,frame.height)} lineCap="round" lineJoin="round" globalCompositeOperation={stroke.mode === "erase" ? "destination-out" : "source-over"} />)}
              </Layer>
              <Layer visible={showLocal} listening={!saving && !showOriginal}>
                {[...operations.filter(item => item.type === "add_text" && item.operationId !== draft.id).map(item => draftFromOperation(item, version.width, version.height)), ...(textVisible ? [draft] : [])].map(d => {
                  const active = d.id === draft.id;
                  const value = d.tool === "add_text" ? d.text || "文字位置" : d.newText || d.originalText || "文字区域";
                  const width = d.region.width * frame.width, height = d.region.height * frame.height;
                  return <Group key={d.id} ref={active ? textRef : undefined} x={d.region.x*frame.width} y={d.region.y*frame.height} width={width} height={height} rotation={d.region.rotation} draggable={active && draft.tool === "add_text"} listening={active && draft.tool === "add_text"} onDragEnd={e => updateTextRegion(e.target as Konva.Group)} onTransformEnd={e => updateTextRegion(e.target as Konva.Group)}>
                    <Rect width={width} height={height} stroke="#3b8460" dash={[5,4]} fill="#eaf4edbb" />
                    <Text text={value} width={width} height={height} fontSize={previewSize(d.region, value)} fontFamily="Microsoft YaHei" fill="#174a39" padding={6} listening={false} />
                  </Group>;
                })}
                {draft.tool === "add_text" && <Transformer ref={transformerRef} rotateEnabled={false} enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} borderStroke="#3b8460" anchorStroke="#3b8460" boundBoxFunc={(old,next) => next.width < 10 || next.height < 10 ? old : next} />}
                {(activeRegion || draft.tool === "crop_resize") && <Rect x={displayRegion.x*frame.width} y={displayRegion.y*frame.height} width={displayRegion.width*frame.width} height={displayRegion.height*frame.height} stroke="#3b8460" dash={[6,4]} strokeWidth={2} listening={false} />}
                {draft.tool === "crop_resize" && <><Rect width={frame.width} height={displayRegion.y*frame.height} fill="#0006" listening={false}/><Rect y={(displayRegion.y+displayRegion.height)*frame.height} width={frame.width} height={(1-displayRegion.y-displayRegion.height)*frame.height} fill="#0006" listening={false}/><Rect y={displayRegion.y*frame.height} width={displayRegion.x*frame.width} height={displayRegion.height*frame.height} fill="#0006" listening={false}/><Rect x={(displayRegion.x+displayRegion.width)*frame.width} y={displayRegion.y*frame.height} width={(1-displayRegion.x-displayRegion.width)*frame.width} height={displayRegion.height*frame.height} fill="#0006" listening={false}/></>}
                {draft.tool === "inpaint" && pointer && <Circle x={pointer.x*frame.width} y={pointer.y*frame.height} radius={brush/2} stroke={maskMode === "erase" ? "#666" : "#d44"} strokeWidth={1} listening={false}/>}
              </Layer>
            </Stage>
          </div>
          <div className="wb-editor-bottom">{draft.tool === "inpaint" && <div className="wb-mask-mode" role="group" aria-label="蒙版修正模式"><button type="button" aria-pressed={maskMode === "draw"} onClick={() => setMaskMode("draw")}>绘制选区</button><button type="button" aria-pressed={maskMode === "erase"} onClick={() => setMaskMode("erase")}>擦除选区</button><button type="button" disabled={saving || !draft.strokes.length} onClick={() => patch({strokes:[]})}>清空选区</button></div>}<button type="button" disabled={saving || !history.past.length} onClick={undo}>撤销</button><button type="button" disabled={saving || !history.future.length} onClick={redo}>重做</button></div>
        </div>
        <aside className="wb-editor-options"><fieldset disabled={saving || !session} className="ie-fields">
          {draft.tool === "none" && <p>选择“描述修改”，直接输入你希望这张图片如何变化；也可以选择其他工具精细编辑。</p>}
          {draft.tool === "prompt_edit" && <><strong>描述修改</strong><label>修改要求<textarea aria-label="修改要求" rows={7} maxLength={8000} value={draft.prompt} onChange={e => patch({prompt:e.target.value})} placeholder="例如：把背景换成木质桌面，商品放在桌上，保留包装和文字，光线自然。" /></label><small>使用左侧当前图片作为修改基础。描述要改的内容和需要保留的细节，结果会保存为新图片。</small></>}
          {draft.tool === "add_text" && <><div className="wb-editor-option-head"><strong>添加文字</strong><button type="button" onClick={addTextBox}>新建文字框</button></div><label>精确文字<textarea value={draft.text} maxLength={2000} onChange={e => patch({text:e.target.value})} placeholder="输入图片上要出现的文字"/></label><label>添加文字要求<textarea value={draft.prompt} onChange={e => patch({prompt:e.target.value})} placeholder="可选：描述字形、颜色或与画面的融合效果"/></label><small>在图片上拖动、缩放文字区域。字体、字号和排版由模型根据画面确定。</small>{draft.textStyle && <div className="ie-legacy-style"><small>此文字框保留了之前保存的手动样式。</small><button type="button" onClick={() => patch({textStyle:undefined})}>改用自动排版</button></div>}</>}
          {draft.tool === "change_text" && <>{capabilities?.ocr && <button type="button" disabled={ocrBusy} onClick={() => void recognize()}>{ocrBusy ? "识别中…" : "识别文字"}</button>}<p>在图片上拖出文字区域，或在下方调整。{!capabilities?.ocr && "当前使用手工框选。"}</p><label>原文字<input value={draft.originalText} onChange={e => patch({originalText:e.target.value})}/></label><label>新文字<input value={draft.newText} onChange={e => patch({newText:e.target.value})}/></label><label>替换要求<textarea value={draft.prompt} onChange={e => patch({prompt:e.target.value})}/></label></>}
          {textVisible && <details className="ie-region-details"><summary>精确调整区域</summary><div className="ie-region-fields">{(["x","y","width","height"] as const).map((key,index) => <label key={key}>{["左侧位置","顶部位置","区域宽度","区域高度"][index]} %<input type="number" min={0} max={100} step={.1} value={Math.round(draft.region[key]*1000)/10} onChange={e => patch({region:{...draft.region,[key]:Number(e.target.value)/100}})}/></label>)}</div></details>}
          {draft.tool === "inpaint" && <><label>修改方式<select value={draft.action} onChange={e => patch({action:e.target.value as "redraw"|"erase",prompt:""})}><option value="redraw" disabled={!capabilities?.redraw}>重绘选中内容</option><option value="erase" disabled={!capabilities?.erase}>移除选中内容</option></select></label><label>笔刷大小<input type="range" min={4} max={120} value={brush} onChange={e => setBrush(Number(e.target.value))}/><output>{brush}px</output></label><label>边缘羽化<input type="range" min={0} max={40} value={Math.round(draft.feather*100)} onChange={e => patch({feather:Number(e.target.value)/100})}/><output>{Math.round(draft.feather*100)}%</output></label><label>{draft.action === "erase" ? "补全要求" : "重绘要求"}<textarea value={draft.prompt} onChange={e => patch({prompt:e.target.value})} placeholder={draft.action === "erase" ? "可选：移除内容后自然补全背景" : "描述选区里要变成什么，其他区域会保留"}/></label><small>已记录 {draft.strokes.length} 条选区笔画</small></>}
          {draft.tool === "crop_resize" && <><label>裁剪比例<select value={cropRatio} onChange={e => selectRatio(e.target.value)}><option value="original">原比例 / 重置</option><option value="custom" disabled>自定义</option>{["1:1","3:4","4:3","9:16","16:9"].map(r => <option key={r}>{r}</option>)}</select></label><p>也可直接在图上拖出裁剪区域。</p><label>输出宽度<input type="number" min={1} max={30000} value={draft.width} onChange={e => resize("width",Number(e.target.value))}/></label><label>输出高度<input type="number" min={1} max={30000} value={draft.height} onChange={e => resize("height",Number(e.target.value))}/></label><label className="ie-checkbox"><input type="checkbox" checked={draft.lockRatio} onChange={e => patch({lockRatio:e.target.checked})}/>锁定裁剪比例</label><output>{draft.width} × {draft.height} px</output>{(draft.width>version.width*draft.crop.width || draft.height>version.height*draft.crop.height) && <small>放大会插值缩放，不会增加原图细节。</small>}<small>裁剪在其他修改完成后执行。</small></>}
          </fieldset><div className="wb-editor-operations"><strong>已添加修改</strong>{operations.some(item => !isSupportedOperation(item)) && <p className="wb-editor-error">包含已收起的旧工具操作，请移除后再提交。</p>}{operations.map(item => <div key={item.operationId}><button type="button" className="wb-operation-edit" disabled={saving || !isSupportedOperation(item)} onClick={() => editOperation(item)}>{item.summary}</button><button type="button" disabled={saving} onClick={() => void remove(item.operationId)}>移除</button></div>)}</div>
        </aside>
        <footer className="wb-editor-footer"><span>{saving ? "正在保存与提交…" : pending || newEdits ? "有待保存修改，确认时会一并保存" : session ? "修改已保存" : "正在加载编辑会话"}<small>{needsModel ? "确认后调用生图服务，结果作为新图片保存" : "本地处理，不调用生图服务"}</small></span>{error && <strong role="alert">{error}</strong>}<button type="button" disabled={saving} onClick={onClose}>关闭</button>{draft.tool !== "none" && <button type="button" disabled={saving || !session || !available(draft.tool)} onClick={() => void save()}>{operations.some(item => item.operationId === draft.id) ? "更新修改" : "添加修改"}</button>}<button type="button" className="wb-primary-action" disabled={saving || !session || (!operations.length && draft.tool === "none") || !available(draft.tool)} onClick={() => void save(true)}>{needsModel ? "确认生成修改图" : "确认保存修改图"}</button></footer>
      </div>
    </section>
  </div>;
}

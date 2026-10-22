import { useEffect, useRef, useState } from "react";
import { History, MessageSquare, PanelsTopLeft, Send, Sparkles, X } from "lucide-react";
import type { Project } from "../../api/contracts";
import type { ModulePlanningControls } from "../../hooks/useModulePlanning";
import type { PlanningConversationControls } from "../../hooks/usePlanningConversation";
import { hasPlanningInput } from "../../lib/planning-master";
import type { PlanningConfig } from "../../lib/planning-master";
import { ProductAssetPicker } from "../../components/generation-workspace/ProductAssetPicker";
import { selectableProductAssets } from "../../lib/generation-workspace";
import { PlanningConversationPreview } from "./PlanningConversationPreview";
import { PlanningConversationMessages } from "./PlanningConversationMessages";
import "./planning-conversation.css";
export function PlanningConversationDialog({ controller: c, planner, project, config, onBriefChange, mode, onAssetIdsChange, onUpload }: { controller: PlanningConversationControls; planner: ModulePlanningControls; project: Project; config: PlanningConfig; onBriefChange: (brief: string) => void; mode: "hero" | "suite"; onAssetIdsChange: (ids: string[]) => void; onUpload: (files: File[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [history, setHistory] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"preview" | "chat">("preview");
  const previewTab = useRef<HTMLButtonElement>(null);
  const chatTab = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  useEffect(() => {
    if (!c.open) { dialog.current?.close(); return; }
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); c.setOpen(false); } };
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("keydown", escape, true); dialog.current?.close(); previous?.focus(); };
  }, [c.open]);
  const busy = c.generating || c.applying || c.loading || planner.planning;
  const send = () => {
    if (!c.session || busy || c.unknown || !text.trim()) return;
    const submitted = text.trim(); setText("");
    void c.sendFeedback(submitted).then(success => { if (!success) setText(current => current || submitted); });
  };
  const initialBlockReason = c.loading ? "正在读取规划会话，请稍候。"
    : planner.references?.loading ? "正在读取参考方案，请稍候。"
    : !config.selectedAssetIds.length ? "请先选择至少一张产品图，再开始规划。"
    : !hasPlanningInput(config) ? "请填写商品信息或规划需求，再开始规划。" : "";
  return <dialog ref={dialog} className="planning-conversation-dialog" aria-labelledby="planning-dialog-title" onKeyDown={e => { if (e.key === "Escape") e.stopPropagation(); }} onCancel={() => c.setOpen(false)} onClose={() => c.setOpen(false)}>
    <header className="planning-dialog-header"><div className="planning-dialog-identity"><span className="planning-dialog-mark"><Sparkles size={19} aria-hidden="true" /></span><div><h1 id="planning-dialog-title">规划大师</h1><p>{project.name} · {config.creationMode === "regular" ? "常规版" : "专业版"} · {mode === "hero" ? "主图" : "图片规划"}</p></div></div>
      <div className="planning-dialog-actions"><button type="button" disabled={!c.session || c.loading} aria-expanded={history} aria-controls="planning-history" onClick={() => { setHistory(!history); setMobilePanel("preview"); if (!history) void c.loadHistory(); }}><History size={15} aria-hidden="true" />版本历史</button><button type="button" className="planning-close" aria-label="关闭规划大师" onClick={() => c.setOpen(false)}><X size={18} aria-hidden="true" /></button></div></header>
    <div className="planning-mobile-tabs" role="tablist" aria-label="规划工作区" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "preview" : event.key === "End" ? "chat" : mobilePanel === "preview" ? "chat" : "preview";
      setMobilePanel(next);
      (next === "preview" ? previewTab : chatTab).current?.focus();
    }}>
      <button ref={previewTab} id="planning-preview-tab" type="button" role="tab" aria-selected={mobilePanel === "preview"} aria-controls="planning-preview-panel" tabIndex={mobilePanel === "preview" ? 0 : -1} onClick={() => setMobilePanel("preview")}><PanelsTopLeft size={15} aria-hidden="true" />方案预览{c.pending && <span className="planning-pending-dot" aria-label="有未应用修改" />}</button>
      <button ref={chatTab} id="planning-chat-tab" type="button" role="tab" aria-selected={mobilePanel === "chat"} aria-controls="planning-chat-panel" tabIndex={mobilePanel === "chat" ? 0 : -1} onClick={() => setMobilePanel("chat")}><MessageSquare size={15} aria-hidden="true" />规划对话</button>
    </div>
    <div className="planning-dialog-body">
      <div className="planning-preview-scroll" id="planning-preview-panel" role="tabpanel" aria-label="方案预览区" data-active={mobilePanel === "preview"}>
        <div className="planning-panel-heading"><span>商品资料与方案</span><small>修改先预览，确认后应用</small></div>
        {history && <section id="planning-history" className="planning-history"><h2>已应用版本</h2>{!c.versions.length && <p>暂无已应用版本</p>}{c.versions.map(v => <div key={v.id}><span>版本 {v.versionNumber}<small>{new Date(v.createdAt).toLocaleString()}</small></span><button type="button" disabled={busy || v.id === c.session?.currentVersionId} onClick={() => void c.restore(v.id)}>恢复版本 {v.versionNumber}</button></div>)}</section>}
        <section className="planning-product-brief">
          <h2>告诉规划大师</h2>
          <label htmlFor="planning-product-input">商品信息与规划需求</label>
          <textarea id="planning-product-input" rows={3} maxLength={20000} value={config.planningBrief ?? ""} disabled={c.applying} onChange={e => onBriefChange(e.target.value)} aria-describedby="planning-input-help" placeholder="例如：这是一款办公鼠标，面向上班族；希望突出握持舒适和真实细节，整套简洁，首屏少放文字。已确认参数：……" />
          <p id="planning-input-help" className="planning-input-help">可以一起说明商品信息、目标人群、想突出什么、页面顺序和视觉偏好；也可以直接描述你的需求。</p>
          <fieldset className="planning-materials" disabled={c.applying}>
            <legend>产品素材</legend>
            <ProductAssetPicker assets={selectableProductAssets(project.assets)} selectedIds={config.selectedAssetIds} max={mode === "hero" ? 8 : 4} onChange={onAssetIdsChange} onUpload={onUpload} />
          </fieldset>
          {!c.session && <>
            <p>根据当前商品信息与需求，按现有规则生成初始方案。</p>
            {initialBlockReason && <p id="planning-initial-block-reason" className="planning-input-help" role="status">{initialBlockReason}</p>}
            <button type="button" className="planning-primary" aria-describedby={initialBlockReason ? "planning-initial-block-reason" : undefined} disabled={busy || !!initialBlockReason} onClick={() => void planner.plan()}><Sparkles size={15} aria-hidden="true" />{planner.planning ? "初始规划中…" : "初始规划"}</button>
          </>}
          {planner.summary && <p role="status">{planner.summary}</p>}
          {planner.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
        </section>
        {c.session && <>{c.pending && <PlanningConversationPreview snapshot={c.pending} diff={c.session.diff} pending />}<details className="planning-current-details" open={!c.pending}><summary>查看当前规划</summary><PlanningConversationPreview snapshot={c.session.currentSnapshot} /></details></>}
        {c.loading && <p role="status">正在读取规划会话…</p>}
      </div>
      <section className="planning-chat" id="planning-chat-panel" role="tabpanel" aria-label="对话与反馈区" data-active={mobilePanel === "chat"}>
        <div className="planning-chat-heading"><MessageSquare size={15} aria-hidden="true" /><span>和规划大师一起完善方案</span></div>
        <PlanningConversationMessages messages={c.messages} generating={c.generating} sending={c.sending} />
        {(c.stale || c.session?.currentTurn?.status === "stale") && <p role="status" className="planning-state-notice">当前资料已变化，请发送新的修改意见更新预览。</p>}
        {c.unknown && <p className="planning-state-notice">请求结果尚未确认。重新读取同一请求可避免重复规划。</p>}
        <form onSubmit={event => { event.preventDefault(); send(); }}>
          <label htmlFor="planning-feedback">规划对话</label><textarea id="planning-feedback" rows={3} maxLength={4000} value={text} disabled={!c.session || busy || c.unknown} onChange={e => setText(e.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => {
            if (event.key !== "Enter" || event.shiftKey || composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
            event.preventDefault(); send();
          }} aria-describedby="planning-send-help" placeholder="例如：为什么第二张这样安排？能只展示糖粒吗？或者：把第二张改成局部特写。" />
          <div><p id="planning-send-help">Enter 发送，Shift+Enter 换行；修改先预览，确认后应用。</p>{c.unknown ? <button type="button" className="planning-primary" disabled={c.generating} onClick={() => void c.sendFeedback("")}>重新读取同一请求</button> : <button type="submit" className="planning-primary" disabled={!c.session || busy || !text.trim()}><Send size={14} aria-hidden="true" />{c.sending ? "发送中…" : "发送"}</button>}</div>
        </form>
      </section>
    </div>
    {(c.error || planner.error || c.session?.currentTurn?.result?.error?.message) && <p role="alert" className="planning-error planning-dialog-error">{c.error || planner.error || c.session?.currentTurn?.result?.error?.message}</p>}
    <footer className={`planning-dialog-footer${c.pending ? " has-preview" : ""}`}><span>{c.pending ? "修改尚未应用到当前规划" : "当前规划用于下一次编译"}</span>{c.pending && <div><button type="button" className="planning-mobile-review" onClick={() => setMobilePanel("preview")}>查看修改</button><button type="button" disabled={busy} onClick={() => void c.discard()}>放弃预览</button><button type="button" className="planning-primary" disabled={busy || (c.stale || c.session?.currentTurn?.status === "stale")} onClick={() => void c.apply()}>{c.applying ? "应用中…" : "应用修改"}</button></div>}</footer>
  </dialog>;
}

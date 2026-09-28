import { useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ArrowUpRight, Sparkles, X } from "lucide-react";
import type { CanvasNode, GenerationStep } from "./model";
import { DesignBrief, presenceLabel, readDesignBrief } from "./DesignBrief";

const nameOf = (value: unknown): string => typeof value === "string" ? value : value && typeof value === "object" ? String((value as Record<string, unknown>).name ?? (value as Record<string, unknown>).label ?? "") : "";
const styleModes: Record<string, string> = { reference: "参考图片", prompt: "提示词版本", custom: "自写提示词" };
function parameters(step: GenerationStep) {
  const p = step.parameters;
  return [nameOf(p.providerModel || p.modelPreset), nameOf(p.aspectRatio || p.ratio), nameOf(p.resolution || p.size)].filter(Boolean);
}

export function GenerationNode({ data, selected }: NodeProps<CanvasNode>) {
  const step = data.step!;
  const brief = readDesignBrief(step.parameters);
  const summary = [brief.informationQuestion, brief.visualMechanism, brief.productPresence ? `商品：${presenceLabel(brief.productPresence)}` : "", brief.compositionBrief, ...(Array.isArray(brief.compositionRequirements) ? brief.compositionRequirements : [])].filter(Boolean).join(" · ");
  const isStyle = step.kind === "style-harmonization";
  const originalRunning = !!step.batchStatus && !["succeeded", "failed", "partially_failed", "cancelled"].includes(step.batchStatus);
  return <article className={`ic-generation-node ${selected ? "is-selected" : ""}`}>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <header><span><Sparkles size={14} />{isStyle ? "风格统一" : step.kind === "white" ? "白底图生成" : step.kind === "hero" ? "主图生成" : step.kind === "suite" ? "详情套图生成" : step.kind === "edit" ? "图片修改" : "生成步骤"}</span><small>{step.outputNodeIds.length} 张</small></header>
    <h3>{step.title} {!isStyle && <small>V{step.revisionNumber ?? 1}</small>}</h3>
    {isStyle && <div className="ic-step-params"><span>{styleModes[String(step.parameters.styleMode)] ?? "风格候选"}</span><span>独立候选 · 原图保留</span></div>}
    {!!step.constraints.style?.content && <div className="ic-constraint"><b>风格</b><p>{step.constraints.style.content}</p></div>}
    {!!step.constraints.market?.content && <div className="ic-constraint"><b>平台</b><p>{step.constraints.market.content}</p></div>}
    {!!summary && <div className="ic-design-brief" aria-label="本图设计"><b>本图设计</b><p title={summary}>{summary}</p></div>}
    <div className="ic-step-prompt"><span>{step.kind === "edit" ? "修改指令" : "提示词"}</span><p>{step.taskPrompt || step.finalPrompt || "历史提示词未记录"}</p></div>
    {step.missingSource && <p className="ic-lineage-warning">来源记录待补全</p>}
    {!!parameters(step).length && <div className="ic-step-params">{parameters(step).map((p, i) => <span key={i}>{p}</span>)}</div>}
    <button className="nodrag nopan" onClick={() => data.openStep?.(step)}>查看生成依据<ArrowUpRight size={13} /></button>
    {data.regenerateStep && step.canRegenerate !== false && !isStyle && <button className="nodrag nopan ic-regenerate-action" disabled={originalRunning || step.missingSource || step.id.startsWith("unknown:")} onClick={() => data.regenerateStep?.(step)}><Sparkles size={13} />{originalRunning ? "原批次生成中" : "修改提示词并生成"}</button>}
    {isStyle && <p className="ic-note">可在“制作长图”中查看、采用或重新提交风格候选。</p>}
    {data.generationStatus && ["queued", "generating", "failed", "partial"].includes(data.generationStatus) && <p className="ic-lineage-warning">V{data.latestRevisionNumber} · {data.generationStatus === "queued" ? "等待生成" : data.generationStatus === "generating" ? "生成中，保留当前图片" : data.generationStatus === "partial" ? "部分失败，可打开提示词重新提交" : "生成失败，可打开提示词重新提交"}</p>}
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </article>;
}

export function GenerationDetails({ step, close }: { step: GenerationStep; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const p = step.parameters;
  const constraintRows: Array<[string, string | undefined]> = [["商品真实性", step.constraints.authenticity?.content], ["全局风格", step.constraints.style?.content], ["电商平台", step.constraints.market?.content], ["模块提示词", step.taskPrompt], ["自定义风格", nameOf(p.customStyle)]];
  return <dialog ref={dialog} className="ic-generation-dialog" aria-label="生成依据" onCancel={close}>
    <header><div><small>生成时的记录</small><h2>{step.title}</h2></div><button autoFocus aria-label="关闭生成依据" onClick={close}><X size={18} /></button></header>
    <div className="ic-generation-detail-body">
      <p className="ic-note">以下内容来自此次生成的快照，后续修改提示词或配置不会改变这份记录。</p>
      {step.missingSource && <p className="ic-lineage-warning">部分来源记录缺失，未自动推测输入图片。</p>}
      <section><h3>生成参数</h3><p>{parameters(step).join(" · ") || "历史记录未保存模型、比例或分辨率"}</p></section>
      {step.kind === "style-harmonization" && <section><h3>风格统一方式</h3><p>{styleModes[String(p.styleMode)] ?? "风格候选"}</p>{!!p.referenceAsset && <p>参考图片：{String((p.referenceAsset as Record<string, unknown>).filename ?? "历史参考图片")}</p>}<p>此次结果为独立候选，原图保留。</p></section>}
      <DesignBrief parameters={p} />
      {constraintRows.map(([label, text]) => text ? <section key={label}><h3>{label}</h3><p>{text}</p></section> : null)}
      {Array.isArray(p.moduleParameters) && !!p.moduleParameters.length && <section><h3>补充参数</h3>{p.moduleParameters.map((item: unknown, i: number) => { const value = item as Record<string, unknown>; return <p key={i}>{String(value.name ?? value.key ?? "参数")}：{String(value.value ?? value.content ?? "")}</p>; })}</section>}
      <section><h3>最终发送的完整提示词</h3><p>{step.finalPrompt || "此历史记录未保存最终提示词"}</p></section>
    </div>
  </dialog>;
}

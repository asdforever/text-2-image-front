import type { ConversationDiff } from "../../api/planning-conversations";
import type { EffectiveSnapshot } from "../../lib/planning-conversation";
const labels: Record<string, string> = { reason: "内容目标", suggestedCopy: "批准文案", taskTitle: "任务标题", informationQuestion: "本图要讲什么", productPresence: "商品出场", visualMechanism: "表达方式", compositionBrief: "构图建议", parameterOverrides: "补充参数", regularOptions: "文案策略与视觉要求", sharedVisualDirection: "统一视觉方向", taskDesignOverrides: "设计设置", layoutFamily: "版式", subjectScale: "主体占比", copyDensity: "文案密度", proofStyle: "证明方式", readingRhythm: "阅读节奏", regularTone: "常规表达风格", bigIdea: "核心创意", designGuideIds: "设计原则", forbiddenMoves: "避免的表达", factAnchors: "事实依据", copyPolicy: "文案策略", visualRequirements: "视觉要求", key: "参数名", value: "参数值" };
const values: Record<string, string> = { auto: "由模型决定", full: "完整展示", detail: "细节特写", context: "场景参与", none: "不出现商品", fixed: "原样使用锁定文案", flexible: "根据当前参数组织文案", large: "大", medium: "中", small: "小", low: "少", balanced: "适中", high: "多" };
const display = (value: unknown): string => {
  if (value == null) return "未设置";
  if (typeof value === "string") return values[value] ?? value;
  if (Array.isArray(value)) return value.map(display).join("；") || "无";
  if (typeof value === "object") { const row = value as Record<string, unknown>; if (typeof row.key === "string" && typeof row.value === "string") return `${row.key}：${row.value}`; return Object.entries(row).map(([key, field]) => `${labels[key] ?? key}：${display(field)}`).join("；") || "未设置"; }
  return String(value);
};
function DiffChange({ change: d }: { change: ConversationDiff }) {
  if (d.kind === "moved") return <p>顺序：第 {display(d.before)} 张 → 第 {display(d.after)} 张</p>;
  if (d.kind === "added") return <p>新增此图</p>;
  return <><strong>{labels[d.field ?? ""] ?? "规划内容"}</strong>{d.parameterChanges?.length ? d.parameterChanges.map((p, i) => <div key={i} className="planning-parameter-change">
    {p.kind === "moved" ? <p>{p.key}顺序：第 {display(p.before)} 项 → 第 {display(p.after)} 项</p> : p.kind === "renamed" ? <p>参数改名：{p.key} → {p.newKey}，值保留为「{display(p.after)}」</p> : <><span>{p.kind === "added" ? "新增参数" : p.kind === "deleted" ? "删除参数" : p.kind === "replaced" ? "参数列表" : "参数修改"} {p.key}</span>{p.kind !== "added" && <del>{display(p.before)}</del>}{p.kind !== "deleted" && <ins>{display(p.after)}</ins>}</>}
  </div>) : <><del>{display(d.before)}</del><ins>{display(d.after)}</ins></>}</>;
}
export function PlanningConversationPreview({ snapshot, diff = [], pending = false }: { snapshot: EffectiveSnapshot; diff?: ConversationDiff[]; pending?: boolean }) {
  const regular = snapshot.plan.planningContractVersion === "regular-design-v1";
  return <section className="planning-preview" aria-label={pending ? "修改预览" : "当前规划"}>
    <h2>{pending ? "修改预览" : "当前规划"}</h2><p>{snapshot.plan.summary}</p>
    {snapshot.plan.sharedVisualDirection && <p>统一视觉方向：{snapshot.plan.sharedVisualDirection}</p>}
    {snapshot.plan.modules.map((module, index) => { const task = module.taskId ?? module.moduleId; const changes = diff.filter(d => d.taskId === task); const options = snapshot.regularOptions[task];
      return <article className={`planning-module${changes.length ? " is-changed" : ""}`} key={task}>
        <header><span>图 {index + 1}</span><h3>{module.taskTitle}</h3>{changes.some(d => d.kind === "added") && <em>新增</em>}</header>
        <dl>{regular ? <><div><dt>内容目标</dt><dd>{module.reason || "未填写"}</dd></div><div><dt>{options?.copyPolicy === "fixed" ? "锁定文案" : "参考文案"}</dt><dd>{module.suggestedCopy || "未填写"}</dd></div><div><dt>文案策略</dt><dd>{options?.copyPolicy === "fixed" ? "原样使用锁定文案" : "根据当前参数组织文案"}</dd></div>{options?.visualRequirements && <div><dt>视觉要求</dt><dd>{options.visualRequirements}</dd></div>}</> : <><div><dt>本图要讲什么</dt><dd>{module.informationQuestion}</dd></div><div><dt>表达方式</dt><dd>{module.visualMechanism}</dd></div><div><dt>商品出场</dt><dd>{display(snapshot.taskDesignOverrides?.[task]?.productPresence ?? module.productPresence)}</dd></div><div><dt>构图建议</dt><dd>{module.compositionBrief}</dd></div></>}
          {(snapshot.parameterOverrides[task] ?? module.moduleParameters).filter(p => p.value).map((p, i) => <div key={i}><dt>{p.key}</dt><dd>{p.value}</dd></div>)}
        </dl>
        {changes.length > 0 && <details open className="planning-diff"><summary>本图累计修改</summary>{changes.map((d, i) => <div key={i}><DiffChange change={d} /></div>)}</details>}
      </article>;
    })}
    {diff.filter(d => d.kind === "deleted").map(d => <p key={d.taskId} className="planning-deleted">删除：{display((d.before as { taskTitle?: string })?.taskTitle ?? d.taskId)}</p>)}
    {diff.filter(d => !d.taskId).map((d, i) => <div key={i} className="planning-diff"><DiffChange change={d} /></div>)}
  </section>;
}

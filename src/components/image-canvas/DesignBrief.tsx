export function readDesignBrief(parameters: Record<string, unknown> = {}): Record<string, unknown> {
  const value = parameters.designBrief;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function presenceLabel(value: unknown) {
  const labels: Record<string, string> = { auto: "由模型决定", full: "完整展示", partial: "局部展示", detail: "细节特写", context: "使用情境", none: "不出现" };
  return labels[String(value)] ?? String(value ?? "");
}

export function DesignBrief({ parameters }: { parameters?: Record<string, unknown> }) {
  const brief = readDesignBrief(parameters);
  const rows: Array<[string, string]> = [
    ["任务标题", String(brief.taskTitle ?? "")],
    ["信息目标", String(brief.informationQuestion ?? "")],
    ["表达方式", String(brief.visualMechanism ?? "")],
    ["商品出场", brief.productPresence ? presenceLabel(brief.productPresence) : ""],
    ["构图建议", String(brief.compositionBrief ?? "")],
    ["构图要求", Array.isArray(brief.compositionRequirements) ? brief.compositionRequirements.map(String).join("；") : ""],
  ].filter(([, value]) => value) as Array<[string, string]>;
  if (!rows.length) return null;
  return <section className="ic-design-details" aria-label="本图设计">
    <h3>本图设计</h3>
    {rows.map(([label, value]) => <p key={label}><strong>{label}</strong>：{value}</p>)}
  </section>;
}

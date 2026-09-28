import { useEffect, useState } from "react";
import { modulePlanningApi, type ApiModulePlan } from "../../api/client";
import { useGenerationConfigStore } from "../../store/useGenerationConfigStore";

/** Read existing outlines only; suggestions never mutate the composition recipe. */
export function LongImagePlanningAdvice({ projectId }: { projectId: string }) {
  const [plans, setPlans] = useState<ApiModulePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const catalog = useGenerationConfigStore((state) => state.published);
  useEffect(() => {
    let cancelled = false;
    setPlans([]); setLoading(true); setFailed(false);
    void Promise.allSettled([modulePlanningApi.getLatest(projectId, "suite"), modulePlanningApi.getLatest(projectId, "hero")]).then((results) => {
      if (cancelled) return;
      setPlans(results.flatMap((result) => result.status === "fulfilled" && result.value.status === "completed" ? [result.value] : []));
      setFailed(results.some((result) => result.status === "rejected" && result.reason?.code !== "MODULE_PLAN_NOT_FOUND"));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId, attempt]);

  return <section className="lic-planning-advice" aria-label="拼接顺序建议">
    <h3>拼接顺序建议</h3>
    <p className="lic-muted">参考本项目最近的规划，自行选择对应图片并排列；不同批次的图片请按实际内容调整。</p>
    {loading ? <p role="status">正在读取规划建议…</p> : <>
      {plans.map((plan) => <details key={plan.id} open={plans.length === 1}>
        <summary>{plan.mode === "suite" ? "详情套图" : "主图"}规划 · {plan.modules.length} 张</summary>
        <p>{plan.summary}</p>
        <ol>{plan.modules.map((item, index) => {
          const module = (plan.mode === "suite" ? catalog.suiteModules : catalog.heroModules).find((definition) => definition.id === item.moduleId);
          const topic = item.moduleParameters.find((parameter) => ["本图任务", "主信息", "核心卖点", "细节主体"].includes(parameter.key) && parameter.value.trim())?.value;
          return <li key={item.taskId ?? `${item.moduleId}:${index}`}><strong>{item.taskTitle ?? module?.label ?? `图片 ${index + 1}`}{topic ? `：${topic}` : ""}</strong><p>{item.reason}</p></li>;
        })}</ol>
      </details>)}
      {!plans.length && !failed && <p className="lic-muted">暂无已完成的规划建议，可直接选图并自行排列。</p>}
      {failed && <p className="lic-muted">部分规划建议读取失败，仍可继续拼接。<button type="button" onClick={() => setAttempt((value) => value + 1)}>重试读取建议</button></p>}
    </>}
  </section>;
}

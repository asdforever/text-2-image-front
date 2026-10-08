import type { ReverseExecutionBatch } from "../api/reverse-execution";
import { Button } from "../components/ui/button";

const statusNames: Record<string, string> = { running: "生成中", completed: "已完成", partial: "部分失败", failed: "失败" };

export function ReverseExecutionHistory({ projectId, batches, selectedId, busy, onSelect, onRetry }: {
  projectId: string; batches: ReverseExecutionBatch[]; selectedId: string; busy: boolean;
  onSelect: (id: string) => void; onRetry: (batch: ReverseExecutionBatch, taskId: string) => void;
}) {
  const selected = batches.find(batch => batch.id === selectedId) ?? batches[0];
  return <section className="project-reverse-history" aria-label="反推批次历史">
    <div className="project-reverse-history-head"><div><h2>反推批次</h2><p>整套生成、生成此张都会新增批次；在这里重试单张保留在原批次。</p></div>
      <a href={`/projects/${encodeURIComponent(projectId)}?tab=canvas`}>在画布查看</a></div>
    {!selected ? <p className="project-reverse-hint">还没有反推批次，点击“整套生成”创建。旧生成结果可在画布中查看。</p> : <>
      <label className="project-reverse-batch-select"><span>历史批次</span><select aria-label="历史批次" value={selected.id} onChange={event => onSelect(event.target.value)}>
        {batches.map(batch => <option key={batch.id} value={batch.id}>批次 {batch.batchNo} · {statusNames[batch.status]} · {new Date(batch.createdAt).toLocaleString("zh-CN")}</option>)}
      </select></label>
      <p className="project-reverse-hint">{selected.planName} · {statusNames[selected.status]} · {selected.progress.succeeded}/{selected.progress.total} 张成功{selected.progress.failed ? ` · ${selected.progress.failed} 张失败` : ""}</p>
      <div className="project-reverse-history-grid">{selected.tasks.filter(task => task.status !== "not_requested").map(task => <article key={task.id} className="project-reverse-history-task">
        <div className="project-reverse-card-head"><h3>图 {task.ordinal} · {task.title}</h3><Button variant="secondary" size="sm" disabled={busy || selected.status === "running"} onClick={() => onRetry(selected, task.id)}>重试此图</Button></div>
        {!task.attempts.length && <p className="project-reverse-hint">{task.error ?? "等待生成结果…"}</p>}
        <div className="project-reverse-attempts">{task.attempts.map(attempt => <div key={attempt.id}>
          {attempt.generatedPreviewUrl ? <a href={attempt.generatedPreviewUrl} target="_blank" rel="noreferrer"><img src={attempt.generatedPreviewUrl} alt={`批次 ${selected.batchNo} 图 ${task.ordinal} 第 ${attempt.number} 次结果`} /></a> : <p>{attempt.error ?? (attempt.status === "generating" ? "正在生成…" : "生成失败")}</p>}
          <small>第 {attempt.number} 次 · {attempt.status === "succeeded" ? "成功" : attempt.status === "failed" ? "失败" : "生成中"}</small>
          {attempt.archiveError && <p>图片已保留，归档失败：{attempt.archiveError}</p>}
        </div>)}</div>
        <details><summary>本批次使用的提示词</summary><pre>{task.promptDraft}</pre></details>
      </article>)}</div>
    </>}
  </section>;
}

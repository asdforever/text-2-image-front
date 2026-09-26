import React from "react";
import type { ApiBatchGenerationDetail } from "../../api/client";

const labels: Record<string, string> = {
  compiling_prompt: "正在编译提示词", compiling: "正在编译提示词", planning: "正在规划模块",
  awaiting_confirmation: "提示词已就绪 · 待确认", confirmed: "已确认 · 正在读取批次",
  queued: "已确认 · 排队中", running: "正在生成图片", generating: "正在生成图片",
  succeeded: "本次任务已完成", completed: "本次任务已完成", partially_failed: "本次任务部分失败",
  failed: "本次任务失败", cancelled: "本次任务已取消", cancel_requested: "正在取消任务",
};

export function GenerationTaskStatus({ batch, status, moduleCount, loading, reconnecting }: {
  batch?: ApiBatchGenerationDetail | null;
  status?: string;
  moduleCount?: number;
  loading?: boolean;
  reconnecting?: boolean;
}) {
  const value = status ?? batch?.status;
  if (!value && !loading && !reconnecting) return null;
  const progress = batch && !["planning", "compiling", "compiling_prompt", "awaiting_confirmation"].includes(value ?? "") ? batch.progress : undefined;
  return <section className={`studio-task-status status-${value ?? "loading"}`} aria-label="当前任务状态" role="status">
    <div><span className="studio-status-dot" /><strong>{reconnecting ? "连接中断 · 正在恢复查询" : labels[value ?? ""] ?? (loading ? "正在恢复任务状态" : "正在处理")}</strong>
      <small>{moduleCount ?? batch?.modules.length ?? 0} 个模块{progress ? ` · 计划 ${progress.total} 张` : ""}</small>
    </div>
    {progress ? <><div className="studio-task-numbers"><span>已完成 <b>{progress.succeeded} / {progress.total}</b> 张</span>{progress.failed > 0 && <span>失败 {progress.failed} 张</span>}{progress.needsRetry > 0 && <span>待重试 {progress.needsRetry} 张</span>}</div><progress aria-label="当前任务图片完成进度" value={progress.succeeded} max={Math.max(1, progress.total)} /></> : <p>可以切换工作区；已提交的任务会继续处理。</p>}
  </section>;
}

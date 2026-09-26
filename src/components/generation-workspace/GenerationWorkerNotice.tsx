import React, { useEffect, useState } from "react";
import { batchGenerationApi } from "../../api/client";

export function GenerationWorkerNotice({ queued }: { queued: number }) {
  const [status, setStatus] = useState<"online" | "offline" | "unknown">("unknown");
  useEffect(() => {
    if (!queued) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await batchGenerationApi.workerStatus();
        if (active) setStatus(value.status);
      } catch { if (active) setStatus("unknown"); }
      if (active) timer = setTimeout(() => void poll(), 10000);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [queued]);
  if (!queued) return null;
  return <p role="status" className={`generation-worker-notice${status === "offline" ? " is-offline" : ""}`}>
    {status === "offline" ? "生图服务未运行或心跳已中断，已确认的任务仍保留在队列中。恢复服务后会继续处理，无需重复确认。"
      : status === "online" ? "已确认，等待执行。生图服务在线，图片将按队列顺序处理。"
      : "已确认，暂未获取到生图服务状态，正在重查。无需重复确认。"}
  </p>;
}

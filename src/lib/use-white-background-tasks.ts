import { useEffect, useRef, useState } from "react";
import { projectApi, type ApiImageEditTask } from "../api/client";
import { isImageEditTaskActive } from "./image-editing-task";

export function useWhiteBackgroundTasks(projectId: string, refresh: () => Promise<void>) {
  const [tasks, setTasks] = useState<ApiImageEditTask[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refreshed = useRef(new Set<string>());
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: number | undefined;
    const read = async () => {
      if (cancelled || inFlight) return;
      window.clearTimeout(timer);
      inFlight = true;
      let retry = false;
      try {
        const result = await projectApi.listWhiteBackgroundGenerations(projectId);
        if (cancelled) return;
        setTasks(result);
        setError("");
        retry = result.some(task => isImageEditTaskActive(task.status));
        const completed = result.filter(task => task.status === "succeeded" && !refreshed.current.has(task.id));
        if (completed.length) {
          await refreshRef.current();
          if (!cancelled) completed.forEach(task => refreshed.current.add(task.id));
        }
      } catch {
        if (!cancelled) setError("暂时无法查询白底图任务，正在自动重试；已提交任务仍在后台处理，请勿重复生成。");
        retry = true;
      } finally {
        inFlight = false;
        if (!cancelled && retry) timer = window.setTimeout(() => void read(), 3000);
      }
    };
    const resume = () => { if (document.visibilityState === "visible") void read(); };
    void read();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { cancelled = true; window.clearTimeout(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [projectId, revision]);

  const track = (task: ApiImageEditTask) => {
    setTasks(current => [...current.filter(item => item.id !== task.id), task]);
    setRevision(value => value + 1);
  };
  return { tasks, error, track };
}

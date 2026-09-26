import { useEffect, useRef, useState } from "react";

/** 恢复仅查询已提交的任务；组件卸载只停止查询，不取消或重新提交任务。 */
export function useTaskRecovery<T>({ identity, enabled = true, read, onValue, shouldPoll, allowNotFound = false }: {
  identity: string;
  enabled?: boolean;
  read: () => Promise<T | null>;
  onValue: (value: T) => void | Promise<void>;
  shouldPoll: (value: T) => boolean;
  allowNotFound?: boolean;
}) {
  const callbacks = useRef({ read, onValue, shouldPoll });
  callbacks.current = { read, onValue, shouldPoll };
  const [loading, setLoading] = useState(enabled);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) { setLoading(false); setMissing(false); setError(""); return; }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setError("");
    setMissing(false);
    const poll = async () => {
      let again = true;
      try {
        const value = await callbacks.current.read();
        if (!active) return;
        setMissing(value === null);
        setError("");
        if (value) {
          await callbacks.current.onValue(value);
          again = callbacks.current.shouldPoll(value);
        }
      } catch (cause) {
        if (!active) return;
        if (allowNotFound && (cause as { status?: number })?.status === 404) {
          again = false;
          setMissing(false);
          setError("");
        } else {
          setError((cause instanceof Error ? cause.message : "任务状态读取失败") + "，正在重连；不会重新生成。");
        }
      } finally {
        if (active) {
          setLoading(false);
          if (again) timer = setTimeout(() => void poll(), 1500);
        }
      }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [identity, enabled, allowNotFound]);
  return { loading, missing, error };
}

import React from "react";
import { RotateCcw, X } from "lucide-react";
import { Button } from "../ui/button";

export function RecentConfigCard({
  updatedAt,
  summary,
  onRestore,
  onDismiss,
}: {
  updatedAt: string;
  summary: string;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  const time = new Date(updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="recent-config-card">
      <div className="recent-config-icon"><RotateCcw size={16} /></div>
      <div className="recent-config-copy">
        <strong>继续上次的配置</strong>
        <span>{time} · {summary}</span>
      </div>
      <Button size="sm" onClick={onRestore}>继续生成</Button>
      <button type="button" className="recent-config-dismiss" aria-label="关闭历史配置" onClick={onDismiss}><X size={13} /></button>
    </section>
  );
}

import React, { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function GenerationWorkspaceLayout({
  config,
  footer,
  result,
  collapsed,
  onCollapsedChange,
}: {
  config: ReactNode;
  footer: ReactNode;
  result: ReactNode;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (collapsed) restoreButtonRef.current?.focus();
  }, [collapsed]);
  useEffect(() => {
    if (collapsed) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCollapsedChange(true);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [collapsed, onCollapsedChange]);
  const className = ["generation-workspace", collapsed ? "is-config-collapsed" : ""].filter(Boolean).join(" ");
  return (
    <div className={className}>
      {!collapsed && (
        <aside className="generation-config" aria-label="生成配置">
          <div className="generation-config-mobile-head">
            <strong>生成配置</strong>
            <button type="button" aria-label="关闭生成配置" onClick={() => onCollapsedChange(true)}><X size={16} /></button>
          </div>
          <div className="generation-config-scroll">{config}</div>
          <div className="generation-config-footer">{footer}</div>
        </aside>
      )}
      {!collapsed && <button className="generation-config-backdrop" aria-label="关闭生成配置" onClick={() => onCollapsedChange(true)} />}
      <main className="generation-result">
        {collapsed && (
          <button ref={restoreButtonRef} className="generation-config-restore" type="button" onClick={() => onCollapsedChange(false)}>
            展开配置
          </button>
        )}
        {result}
      </main>
    </div>
  );
}

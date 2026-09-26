import React, { useId } from "react";
import { Sparkles } from "lucide-react";

export function CountedPromptField({
  label,
  value,
  maxLength,
  onChange,
  placeholder,
  pro = false,
  optional = false,
  onOptimize,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder?: string;
  pro?: boolean;
  optional?: boolean;
  onOptimize?: () => void;
}) {
  const inputId = useId();
  const countId = inputId + "-count";
  return (
    <div className="counted-prompt-field">
      <div className="field-label">
        <label htmlFor={inputId}><strong>{label}</strong></label>
        {pro && <span className="generation-pro-badge">专业版</span>}
        {optional && <span className="field-optional">可选</span>}
      </div>
      <textarea id={inputId} aria-describedby={countId} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      <div className="counted-field-meta">
        {onOptimize ? <button type="button" onClick={onOptimize}><Sparkles size={12} />一键优化</button> : <span />}
        <span id={countId}>{value.length}/{maxLength}</span>
      </div>
    </div>
  );
}

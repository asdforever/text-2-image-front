import React from "react";
import type { CreationMode } from "../../lib/generation-workspace";

export function CreationModeSwitch({ value, disabled, onChange }: { value?: CreationMode; disabled?: boolean; onChange: (mode: CreationMode) => void }) {
  return <div className="creation-mode-switch" role="group" aria-label="创作模式">
    {(["regular", "professional"] as const).map(mode => <button key={mode} type="button" disabled={disabled} aria-pressed={(value ?? "professional") === mode} onClick={() => onChange(mode)}>{mode === "regular" ? "常规版" : "专业版"}</button>)}
  </div>;
}


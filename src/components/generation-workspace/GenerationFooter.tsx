import React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/button";

export function GenerationFooter(props: {
  label: string;
  countLabel: string;
  errors: string[];
  busy: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="generation-footer-content">
      <div className="generation-footer-meta">
        <span>{props.countLabel}</span>
        {props.errors.length > 0 && <span role="alert">{props.errors[0]}</span>}
      </div>
      <Button disabled={props.busy || props.disabled} onClick={props.onSubmit}>
        <Sparkles size={15} />{props.busy ? "处理中…" : props.label}
      </Button>
    </div>
  );
}

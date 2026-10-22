import React, { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ConfigSectionCard({
  title,
  description,
  badge,
  collapsible = false,
  defaultOpen = true,
  error,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  useEffect(() => { if (error) setOpen(true); }, [error]);
  return (
    <section className="generation-section-card" data-generation-invalid={error ? "true" : undefined}>
      <div className="generation-section-heading">
        <div>
          <h2 className="generation-section-title">
            {title}
            {badge && <span className="generation-pro-badge">{badge}</span>}
          </h2>
          {description && <p>{description}</p>}
        </div>
        {collapsible && (
          <button type="button" aria-expanded={open} aria-controls={contentId} aria-label={open ? "折叠" + title : "展开" + title} onClick={() => setOpen((value) => !value)}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      {error && <p className="generation-field-error" role="alert">{error}</p>}
      {open && <div className="generation-section-content" id={contentId}>{children}</div>}
    </section>
  );
}

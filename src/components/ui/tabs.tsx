import type { ReactNode } from "react";

export function Tabs({ children }: { children: ReactNode }) {
  return <div className="ui-tabs">{children}</div>;
}

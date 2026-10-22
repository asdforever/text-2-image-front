import { useState } from "react";
import { Handle, Position, useConnection } from "@xyflow/react";
import { Plus, X } from "lucide-react";
import type { CanvasNode } from "./model";

export function CanvasPorts({ id, data }: { id: string; data: CanvasNode["data"] }) {
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const connecting = useConnection(state => state.inProgress);
  // Candidate validation walks the graph; keep closed ports cheap during dragging.
  const candidates = side ? data.connectionCandidates?.() ?? [] : [];
  return <>
    <Handle type="target" position={Position.Left} className="ic-port ic-port-in" title="上游（左侧）" />
    <Handle type="source" position={Position.Right} className="ic-port" title="下游（右侧）" />
    {!connecting && (["left", "right"] as const).map(position => <div key={position} className={`ic-connect-slot is-${position} nodrag nopan ${side === position ? "is-open" : ""}`} onClick={event => event.stopPropagation()}>
      <button aria-label={position === "left" ? "连接上游节点" : "连接下游节点"} title={position === "left" ? "选择已有上游节点" : "选择已有下游节点"} className="ic-connect-add" onClick={() => setSide(side === position ? null : position)}><Plus size={13} /></button>
      {side === position && <div className="ic-connect-menu nowheel" role="dialog" aria-label={position === "left" ? "选择上游节点" : "选择下游节点"}>
        <header><strong>{position === "left" ? "连接上游" : "连接下游"}</strong><button aria-label="关闭连接菜单" onClick={() => setSide(null)}><X size={13} /></button></header>
        <div>{candidates.filter(candidate => (position === "left" ? candidate.upstream : candidate.downstream)).map(candidate => <button key={candidate.id} onClick={() => { data.connectNodes?.(position === "left" ? candidate.id : id, position === "left" ? id : candidate.id); setSide(null); }}>{candidate.title}</button>)}
        {!candidates.some(candidate => position === "left" ? candidate.upstream : candidate.downstream) && <p>暂无可连接节点</p>}</div>
      </div>}
    </div>)}
  </>;
}

import type { ApiCanvasLayout } from "../../api/client";
import type { CanvasNode } from "./model";

export type CanvasConnection = { source: string; target: string };
type LayoutNode = ApiCanvasLayout["nodes"][number];

// Store outgoing canvas links alongside node positions in the existing JSON layout.
// These do not change the immutable source IDs in generation snapshots.
export function readConnections(layout: { nodes: LayoutNode[] } | null | undefined): CanvasConnection[] {
  const result: CanvasConnection[] = [];
  for (const node of layout?.nodes ?? []) {
    for (const target of node.connections ?? []) {
      if (typeof target === "string" && target !== node.nodeId && !result.some(edge => edge.source === node.nodeId && edge.target === target)) result.push({ source: node.nodeId, target });
    }
  }
  return result;
}

export function serializeConnections(nodes: LayoutNode[], connections: CanvasConnection[]): LayoutNode[] {
  return nodes.map(node => {
    const targets = [...new Set(connections.filter(edge => edge.source === node.nodeId).map(edge => edge.target))];
    return targets.length ? { ...node, connections: targets } : node;
  });
}

export function connectionProblem(nodes: CanvasNode[], edges: CanvasConnection[], connection: CanvasConnection): string {
  const source = nodes.find(node => node.id === connection.source && !node.hidden);
  const target = nodes.find(node => node.id === connection.target && !node.hidden);
  if (!source || !target || source.type === "imageGroup" || target.type === "imageGroup") return "请选择画布上的图片或生成节点";
  if (source.id === target.id) return "节点不能连接自己";
  if (edges.some(edge => edge.source === source.id && edge.target === target.id)) return "这两个节点已经连接";
  const visited = new Set<string>();
  const pending = [target.id];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === source.id) return "此连接会形成循环，请选择其他节点";
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(...edges.filter(edge => edge.source === id).map(edge => edge.target));
  }
  return "";
}

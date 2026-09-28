import { graphlib, layout } from "@dagrejs/dagre";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "./model";

function dimensions(node: CanvasNode) {
  const width = node.measured?.width ?? node.width ?? (Number(node.style?.width) || (node.type === "generation" ? 280 : 248));
  const image = node.data.image;
  const pictureRatio = image ? Math.max(.62, Math.min(1.6, image.width / Math.max(1, image.height))) : 1;
  const estimatedHeight = node.type === "generation" ? 420 : width / pictureRatio + 46 + (image?.canvasVersion ? 76 : 0);
  return { width, height: node.measured?.height ?? node.height ?? estimatedHeight };
}

/** Lay out the dependency graph together so sibling branches and their outputs stay aligned. */
export function arrangeGraph(nodes: CanvasNode[], edges: Edge[]): CanvasNode[] {
  const visible = nodes.filter(node => node.type !== "imageGroup" && !node.hidden);
  const byId = new Map(visible.map(node => [node.id, node]));
  const graph = new graphlib.Graph().setGraph({ rankdir: "LR", ranksep: 88, nodesep: 64, edgesep: 24, marginx: 48, marginy: 70 });
  for (const node of visible) graph.setNode(node.id, dimensions(node));
  for (const edge of edges) {
    if (edge.source === edge.target || !byId.has(edge.source) || !byId.has(edge.target)) continue;
    // Keep a generation and its results close; shared inputs can span several branches.
    graph.setEdge(edge.source, edge.target, { weight: byId.get(edge.source)?.type === "generation" ? 4 : 1 });
  }
  if (visible.length) layout(graph);
  // Dagre can spread shared inputs to opposite ends of a fan-out. Recenter upstream
  // columns on their children, retaining the crossing-minimizing order and true sizes.
  const columns = new Map<number, string[]>();
  for (const node of visible) {
    const x = graph.node(node.id).x;
    columns.set(x, [...(columns.get(x) ?? []), node.id]);
  }
  for (const x of [...columns.keys()].sort((a, b) => b - a)) {
    const ids = columns.get(x)!.sort((a, b) => graph.node(a).y - graph.node(b).y);
    const offsets: number[] = [];
    const blocks: { first: number; last: number; sum: number; count: number }[] = [];
    ids.forEach((id, index) => {
      const current = graph.node(id);
      offsets[index] = index ? offsets[index-1] + (graph.node(ids[index-1]).height + current.height) / 2 + 64 : 0;
      const children = (graph.successors(id) ?? []).map(child => graph.node(child)).filter(child => child.x > current.x);
      const desired = children.length ? (Math.min(...children.map(child => child.y)) + Math.max(...children.map(child => child.y))) / 2 : current.y;
      blocks.push({ first: index, last: index, sum: desired - offsets[index], count: 1 });
      // Pool overlapping neighbors instead of pushing the whole column downward.
      while (blocks.length > 1) {
        const right = blocks[blocks.length-1], left = blocks[blocks.length-2];
        if (left.sum/left.count <= right.sum/right.count) break;
        blocks.splice(-2, 2, { first: left.first, last: right.last, sum: left.sum+right.sum, count: left.count+right.count });
      }
    });
    for (const block of blocks) for (let index=block.first; index<=block.last; index++) graph.node(ids[index]).y = block.sum/block.count + offsets[index];
  }
  const top = Math.min(70, ...visible.map(node => { const placed = graph.node(node.id); return placed.y - placed.height/2; }));
  for (const node of visible) graph.node(node.id).y += 70 - top;
  return nodes.filter(node => node.type !== "imageGroup").map(node => {
    const parent = nodes.find(group => group.id === node.parentId);
    const placed = graph.node(node.id);
    const position = node.hidden
      ? { x: node.position.x + (parent?.position.x ?? 0), y: node.position.y + (parent?.position.y ?? 0) }
      : { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 };
    return { ...node, parentId: undefined, extent: undefined, expandParent: undefined, position };
  });
}

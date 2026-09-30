import type { CanvasImage, CanvasNode } from "./model";
import { matchesCanvasImageBatch, type ImageBatchIndex } from "./image-batches";

export function isResultImage(image: CanvasImage): boolean {
  return !!image.url && ["hero", "detail", "generated", "edit"].includes(image.category);
}

/** Display only matching finished pictures, without writing visibility into the stored layout. */
export function resultViewNodes(nodes: CanvasNode[], index: ImageBatchIndex, batchId: string, moduleId: string): CanvasNode[] {
  const visible = new Set(nodes.filter(node => !node.hidden && node.data.image && isResultImage(node.data.image) && matchesCanvasImageBatch(index, batchId, node.data.image, moduleId)).map(node => node.id));
  for (const node of nodes) if (visible.has(node.id) && node.parentId) visible.add(node.parentId);
  return nodes.map(node => ({ ...node, hidden: !visible.has(node.id), selected: visible.has(node.id) && node.selected,
    ...(node.type === "imageGroup" && nodes.some(child => child.parentId === node.id && !visible.has(child.id)) ? { draggable: false, selectable: false } : {}),
  }));
}

/** Arrange every visible result, keeping other batches and hidden pictures in their saved positions. */
export function arrangeResultGrid(nodes: CanvasNode[], visible: CanvasNode[]): CanvasNode[] {
  const images = visible.filter(node => node.type === "image" && !node.hidden);
  const positions = new Map<string, { x: number; y: number }>();
  let y = 70;
  for (let row = 0; row < images.length; row += 3) {
    const items = images.slice(row, row + 3);
    items.forEach((node, column) => positions.set(node.id, { x: 48 + column * 286, y }));
    const height = Math.max(...items.map(node => node.measured?.height ?? 248 / Math.max(.62, Math.min(1.6, node.data.image!.width / Math.max(1, node.data.image!.height))) + (node.data.image!.canvasVersion ? 122 : 46)));
    y += height + 48;
  }
  return nodes.map(node => positions.has(node.id) ? { ...node, parentId: undefined, position: positions.get(node.id)!, selected: false } : { ...node, selected: false })
    .filter(node => node.type !== "imageGroup" || nodes.some(child => child.parentId === node.id && !positions.has(child.id)));
}

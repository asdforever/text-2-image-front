import assert from "node:assert/strict";
import test from "node:test";
import { arrangeResultGrid, isResultImage, resultViewNodes } from "../src/components/image-canvas/result-view";
import type { CanvasImage, CanvasNode } from "../src/components/image-canvas/model";
import type { ImageBatchIndex } from "../src/components/image-canvas/image-batches";

const image = (id: string, category: CanvasImage["category"]): CanvasNode => ({ id, type: "image", position: { x: 900, y: 800 }, data: { image: { id, assetId: id, title: id, category, url: `/images/${id}`, width: 800, height: 1200, versions: [] } } });
const index: ImageBatchIndex = { batches: [], modules: [], membership: new Map([["detail", new Set(["a"])], ["edit", new Set(["a"])], ["other", new Set(["b"])]]), moduleMembership: new Map() };

test("result view hides sources, white images and prompts while retaining generated pictures and edits", () => {
  const nodes = [image("source", "source"), image("white", "white"), image("detail", "detail"), image("edit", "edit"), image("other", "hero"), { ...image("hidden", "detail"), hidden: true }, { id: "prompt", type: "generation", position: { x: 0, y: 0 }, data: {} } as CanvasNode];
  const before = structuredClone(nodes);
  const view = resultViewNodes(nodes, index, "a", "all");
  assert.deepEqual(view.filter(node => !node.hidden).map(node => node.id), ["detail", "edit"]);
  assert.deepEqual(nodes, before);
  assert.equal(isResultImage({ ...nodes[2].data.image!, url: "" }), false);
  const arranged = arrangeResultGrid(nodes, view);
  assert.deepEqual(arranged.find(node => node.id === "detail")!.position, { x: 48, y: 70 });
  for (const id of ["source", "white", "other", "hidden", "prompt"]) {
    assert.deepEqual(arranged.find(node => node.id === id)!.position, nodes.find(node => node.id === id)!.position);
    assert.equal(arranged.find(node => node.id === id)!.hidden, nodes.find(node => node.id === id)!.hidden);
  }
});

test("result rows reserve the tallest image height and do not rearrange only the selected picture", () => {
  const nodes = [image("one", "hero"), image("two", "detail"), image("three", "edit"), image("four", "generated")];
  nodes[1].measured = { width: 248, height: 620 };
  nodes[0].selected = true;
  const arranged = arrangeResultGrid(nodes, nodes);
  assert.deepEqual(arranged.slice(0, 3).map(node => node.position.y), [70, 70, 70]);
  assert.equal(arranged[3].position.y, 70 + 620 + 48);
  assert.equal(arranged.every(node => !node.selected), true);
});

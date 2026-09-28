import test from "node:test";
import assert from "node:assert/strict";
import type { Edge } from "@xyflow/react";
import { arrangeGraph, type CanvasNode } from "../src/components/image-canvas/model";

const node = (id: string, width = 248, height = 320): CanvasNode => ({ id, type: id.startsWith("prompt") ? "generation" : "image", data: {}, position: { x: 0, y: 0 }, measured: { width, height } });
const edge = (source: string, target: string): Edge => ({ id: `${source}->${target}`, source, target });
const center = (n: CanvasNode) => n.position.y + n.measured!.height! / 2;
const find = (nodes: CanvasNode[], id: string) => nodes.find(n => n.id === id)!;

test("脉络排列让提示词与各自结果对齐，不按接口数组顺序错配行", () => {
  const nodes = [node("source"), node("result-b"), node("result-a"), node("prompt-a", 280, 400), node("prompt-b", 280, 240)];
  const edges = [edge("source", "prompt-a"), edge("source", "prompt-b"), edge("prompt-a", "result-a"), edge("prompt-b", "result-b")];
  const arranged = arrangeGraph(nodes, edges);
  for (const suffix of ["a", "b"]) assert.equal(center(find(arranged, `prompt-${suffix}`)), center(find(arranged, `result-${suffix}`)));
  const sourceY = center(find(arranged, "source"));
  const branchYs = ["prompt-a", "prompt-b"].map(id => center(find(arranged, id)));
  assert.ok(sourceY > Math.min(...branchYs) && sourceY < Math.max(...branchYs), "共用来源应处于两个分支之间");
});

test("长卡片按实际尺寸留白，不覆盖同层的下一张卡片", () => {
  const nodes = [node("source"), node("prompt-a", 520, 700), node("prompt-b", 280, 520), node("result-a"), node("result-b")];
  const edges = [edge("source", "prompt-a"), edge("source", "prompt-b"), edge("prompt-a", "result-a"), edge("prompt-b", "result-b")];
  const arranged = arrangeGraph(nodes, edges);
  for (const e of edges) {
    const from = find(arranged, e.source), to = find(arranged, e.target);
    assert.ok(to.position.x >= from.position.x + from.measured!.width! + 40);
  }
  const prompts = arranged.filter(n => n.type === "generation").sort((a,b) => a.position.y-b.position.y);
  assert.ok(prompts[1].position.y >= prompts[0].position.y + prompts[0].measured!.height! + 40);
});

test("同一来源的后续分支连续排列，重复排列不跳动", () => {
  const nodes = [node("root"), node("b"), node("a"), node("b2"), node("a2"), node("a1"), node("b1")];
  const edges = [edge("root", "a"), edge("root", "b"), edge("a", "a1"), edge("a", "a2"), edge("b", "b1"), edge("b", "b2")];
  const arranged = arrangeGraph(nodes, edges);
  const leafOrder = arranged.filter(n => ["a1","a2","b1","b2"].includes(n.id)).sort((a,b) => a.position.y-b.position.y).map(n => n.id[0]).join("");
  assert.ok(["aabb", "bbaa"].includes(leafOrder));
  assert.deepEqual(arrangeGraph(arranged, edges).map(n => n.position), arranged.map(n => n.position));
});

test("拆开分组时隐藏图保留绝对位置，不参与连线布局", () => {
  const group: CanvasNode = { id: "group", type: "imageGroup", data: {}, position: { x: 500, y: 600 } };
  const hidden = { ...node("hidden"), parentId: "group", hidden: true, position: { x: 20, y: 30 } };
  const arranged = arrangeGraph([group, hidden, node("source"), node("result")], [edge("source", "result"), edge("hidden", "result")]);
  assert.equal(arranged.some(n => n.type === "imageGroup"), false);
  assert.deepEqual(find(arranged, "hidden").position, { x: 520, y: 630 });
  assert.equal(find(arranged, "hidden").hidden, true);
  assert.ok(arranged.every(n => !n.parentId && Number.isFinite(n.position.x) && Number.isFinite(n.position.y)));
});


test("多个共用来源集中在分支中部，不被拉到整张长图的上下两端", () => {
  const nodes = [node("source-a"), node("source-b"), ...Array.from({ length: 7 }, (_, i) => [node(`prompt-${i}`, 280, 400), node(`result-${i}`)]).flat()];
  const edges = Array.from({ length: 7 }, (_, i) => [edge("source-a", `prompt-${i}`), edge("source-b", `prompt-${i}`), edge(`prompt-${i}`, `result-${i}`)]).flat();
  const arranged = arrangeGraph(nodes, edges);
  const a = center(find(arranged, "source-a")), b = center(find(arranged, "source-b"));
  assert.ok(Math.abs(a-b) <= 450, "两张共同输入不应被七个输出分支拉散");
  const branchYs = arranged.filter(n => n.type === "generation").map(center);
  assert.ok(Math.abs((a+b)/2 - (Math.min(...branchYs)+Math.max(...branchYs))/2) < 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { connectionProblem, readConnections, serializeConnections } from "../src/components/image-canvas/connections";
import type { CanvasNode } from "../src/components/image-canvas/model";

const nodes: CanvasNode[] = ["a", "b", "c"].map(id => ({ id, type: "image", position: { x: 0, y: 0 }, data: {} }));
test("manual canvas connections survive node layout serialization without altering generation lineage", () => {
  const saved = serializeConnections([{ nodeId: "a", x: 12, y: 34 }, { nodeId: "b", x: 400, y: 50 }], [{ source: "a", target: "b" }]);
  assert.deepEqual(saved, [{ nodeId: "a", x: 12, y: 34, connections: ["b"] }, { nodeId: "b", x: 400, y: 50 }]);
  assert.deepEqual(readConnections({ nodes: saved }), [{ source: "a", target: "b" }]);
  assert.deepEqual(readConnections({ nodes: [{ nodeId: "a", x: 0, y: 0 }] }), []);
});
test("connections reject duplicate, missing, grouped, self and cyclic endpoints", () => {
  assert.equal(connectionProblem(nodes, [], { source: "a", target: "b" }), "");
  assert.ok(connectionProblem(nodes, [], { source: "a", target: "a" }));
  assert.ok(connectionProblem(nodes, [], { source: "missing", target: "a" }));
  assert.ok(connectionProblem([...nodes, { id: "group", type: "imageGroup", position: { x: 0, y: 0 }, data: {} }], [], { source: "a", target: "group" }));
  assert.ok(connectionProblem(nodes, [{ source: "a", target: "b" }], { source: "a", target: "b" }));
  assert.ok(connectionProblem(nodes, [{ source: "a", target: "b" }, { source: "b", target: "c" }], { source: "c", target: "a" }));
  assert.equal(connectionProblem(nodes, [{ source: "a", target: "b" }], { source: "a", target: "c" }), "");
});

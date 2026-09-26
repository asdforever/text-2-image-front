import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const workbench = readFileSync(new URL("../src/pages/ProjectWorkbench.tsx", import.meta.url), "utf8");
const baseWorkspace = readFileSync(new URL("../src/pages/BaseImageWorkspace.tsx", import.meta.url), "utf8");

test("workspace uses a single resizable layout container", () => {
  assert.match(css, /\.workspace-content\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.resizable-workspace\s*\{[^}]*width:\s*100%/);
  assert.doesNotMatch(css, /\.workspace-content\s*\{[^}]*grid-template-columns/);
  assert.match(workbench, /<Group orientation="horizontal" className="resizable-workspace"/);
});

test("project upload controls are wired into the UI", () => {
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(baseWorkspace, /提交素材/);
  assert.match(baseWorkspace, /empty-workspace/);
});

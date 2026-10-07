import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectReverseWorkspace } from "../src/pages/ProjectReverseWorkspace";

test("project reverse workspace renders one editable card per template task", () => {
  const html = renderToStaticMarkup(
    <ProjectReverseWorkspace project={{ id: "project-1", name: "鼠标项目" }} onToast={() => undefined} />,
  );

  assert.match(html, /项目反推/);
  assert.match(html, /模板执行方案/);
});

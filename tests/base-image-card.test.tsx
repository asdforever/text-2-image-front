import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BaseImageCard } from "../src/components/BaseImageCard";
import type { Asset } from "../src/api/contracts";

const source: Asset = {
  id: "source-1", projectId: "project-1", type: "source", name: "商品原图.png",
  dimensions: "1200x1200", url: "/source.png", status: "ready", version: 1, versions: [],
};

test("原图卡片在图片操作区提供白底图生成入口，已有白底图不提供", () => {
  const props = { selected: false, selectionMode: false, onSelect: () => undefined, onPreview: () => undefined, onExport: () => undefined, onDelete: () => undefined, onSetCurrent: () => undefined, onGenerateWhiteBackground: () => undefined, isCurrent: false, isGeneratingWhiteBackground: false };
  const sourceHtml = renderToStaticMarkup(<BaseImageCard asset={source} {...props} />);
  const whiteHtml = renderToStaticMarkup(<BaseImageCard asset={{ ...source, id: "base-1", type: "base" }} {...props} />);

  assert.match(sourceHtml, /生成白底图/);
  assert.doesNotMatch(whiteHtml, /生成白底图/);
});

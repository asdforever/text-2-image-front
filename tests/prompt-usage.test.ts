import assert from "node:assert/strict";
import test from "node:test";
import { canUsePromptForDirectImage } from "../src/lib/prompt-usage";

test("direct image selection excludes every planning role and missing versions", () => {
  for (const runtimeRole of ["style-planner", "planner", "hero-module-planner", "suite-module-planner"]) {
    assert.equal(canUsePromptForDirectImage({ applicability: { runtimeRole } }), false);
  }
  assert.equal(canUsePromptForDirectImage(null), false);
  assert.equal(canUsePromptForDirectImage(undefined), false);
});

test("direct image selection preserves legacy and image constraint versions", () => {
  assert.equal(canUsePromptForDirectImage({}), true);
  assert.equal(canUsePromptForDirectImage({ applicability: { runtimeRole: "image-constraint-fragment" } }), true);
});

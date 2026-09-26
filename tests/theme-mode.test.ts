import assert from "node:assert/strict";
import test from "node:test";
import { applyTheme, useThemeStore } from "../src/store/useThemeStore";

test("theme store supports light/dark switching", () => {
  const store = useThemeStore.getState();
  store.setTheme("light");
  assert.equal(useThemeStore.getState().theme, "light");
  store.setTheme("dark");
  assert.equal(useThemeStore.getState().theme, "dark");
});

test("applyTheme is safe outside the browser", () => {
  assert.doesNotThrow(() => applyTheme("light"));
});

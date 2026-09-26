import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("hero and suite submit paths gate generation on published configuration references", () => {
  const hero = readFileSync(new URL("../src/pages/HeroImageWorkspace.tsx", import.meta.url), "utf8");
  const suite = readFileSync(new URL("../src/pages/SuiteWorkspace.tsx", import.meta.url), "utf8");
  assert.match(hero, /validateGenerationSelection\(publishedConfig, selection\)/);
  assert.match(hero, /nextErrors = \[\.\.\.remoteConfigErrors, \.\.\.validateHeroConfig\(effectiveConfig\), \.\.\.validateGenerationSelection\(publishedConfig, effectiveSelection\), \.\.\.validateBatchHeroSelection/);
  assert.match(hero, /validateBatchHeroSelection\(config\.selectedAssetIds, config\.selectedModuleIds, config\.moduleCounts\)/);
  assert.match(suite, /nextErrors = \[\.\.\.remoteConfigErrors, \.\.\.validateSuiteConfig\(effectiveConfig, publishedConfig.suiteModules.length\), \.\.\.validateGenerationSelection\(publishedConfig, effectiveSelection\)\]/);
  assert.match(suite, /nextErrors.length > 0[\s\S]*suitePlanningApi.compile/);
});

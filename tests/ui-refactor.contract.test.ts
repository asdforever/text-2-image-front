import assert from "node:assert/strict";
import test from "node:test";
import { mockBaseImages, mockProjects, mockSuiteTasks } from "../src/api/fixtures";
import { useProjectStore } from "../src/store/useProjectStore";

test("fixtures expose project, base image, and suite task data", () => {
  assert.ok(mockProjects.length > 0);
  assert.ok(Object.keys(mockBaseImages).length > 0);
  assert.ok(mockSuiteTasks.length > 0);
  assert.deepEqual(mockProjects[0].outputTargets, ["base", "suite"]);
});

test("project store creates and selects a project", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const project = store.createProject({
    name: "测试项目",
    productName: "充电宝",
    outputTargets: ["base"],
    sourceCount: 2,
  });

  assert.equal(useProjectStore.getState().currentProjectId, project.id);
  assert.equal(useProjectStore.getState().projects[0].name, "测试项目");
});

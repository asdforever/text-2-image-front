import assert from "node:assert/strict";
import test from "node:test";
import { filterTaskCenterProjects, groupTaskCenterProjects, hasActiveTaskCenterTasks, isTaskCenterTaskActive, taskCenterStatusLabel, type TaskCenterProject } from "../src/lib/task-center";

const projects: TaskCenterProject[] = [
  { projectId: "p1", projectName: "项目一", projectStatus: "active", updatedAt: "2026-09-21T10:00:00Z", tasks: [
    { id: "h1", projectId: "p1", projectName: "项目一", type: "hero", source: "generation_batch", status: "running", phase: "running", progress: { succeeded: 1, total: 3, failed: 0, cancelled: 0 }, createdAt: "2026-09-21T09:00:00Z", updatedAt: "2026-09-21T10:00:00Z", error: null, workbenchTab: "hero" },
  ] },
  { projectId: "p2", projectName: "项目二", projectStatus: "active", updatedAt: "2026-09-21T11:00:00Z", tasks: [
    { id: "s1", projectId: "p2", projectName: "项目二", type: "suite", source: "suite_plan", status: "awaiting_confirmation", phase: "awaiting_confirmation", progress: null, createdAt: "2026-09-21T10:00:00Z", updatedAt: "2026-09-21T11:00:00Z", error: null, workbenchTab: "suite" },
  ] },
];

test("task center pins the current project and sorts other projects by activity", () => {
  assert.deepEqual(groupTaskCenterProjects(projects, "p1").map((item) => item.projectId), ["p1", "p2"]);
});

test("task center filters by task lifecycle status without mutating groups", () => {
  assert.deepEqual(filterTaskCenterProjects(projects, "awaiting_confirmation").map((item) => item.projectId), ["p2"]);
  assert.equal(projects[0].tasks.length, 1);
});

test("task center uses readable labels for backend statuses", () => {
  assert.equal(taskCenterStatusLabel("compiling_prompt"), "提示词编译中");
  assert.equal(taskCenterStatusLabel("dispatching"), "派发中");
  assert.equal(taskCenterStatusLabel("cancelled"), "已取消");
});

test("task center polls only while a server task can still advance", () => {
  for (const status of ["compiling_prompt", "queued", "leased", "dispatching", "running", "generating", "cancel_requested"]) {
    assert.equal(isTaskCenterTaskActive(status), true, status);
  }
  for (const status of ["awaiting_confirmation", "succeeded", "completed", "partially_failed", "failed", "cancelled", "needs_retry"]) {
    assert.equal(isTaskCenterTaskActive(status), false, status);
  }
  assert.equal(hasActiveTaskCenterTasks(projects), true);
  assert.equal(hasActiveTaskCenterTasks(projects.map((project) => ({ ...project, tasks: project.tasks.map((task) => ({ ...task, status: "completed" })) }))), false);
});

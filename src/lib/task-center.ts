export type TaskCenterTaskType = "hero" | "suite";

export interface TaskCenterProgress {
  succeeded: number;
  total: number;
  failed: number;
  cancelled: number;
}

export interface TaskCenterTask {
  id: string;
  projectId: string;
  projectName: string;
  type: TaskCenterTaskType;
  source: string;
  status: string;
  phase: string;
  progress: TaskCenterProgress | null;
  createdAt: string;
  updatedAt: string;
  error: { code: string; message: string } | null;
  workbenchTab: "hero" | "suite";
}

export interface TaskCenterProject {
  projectId: string;
  projectName: string;
  projectStatus: string;
  updatedAt: string;
  tasks: TaskCenterTask[];
}

export interface ApiTaskCenterResponse {
  projects: TaskCenterProject[];
}

export function groupTaskCenterProjects(projects: TaskCenterProject[], currentProjectId?: string | null) {
  return [...projects].sort((left, right) => {
    if (currentProjectId && left.projectId === currentProjectId) return -1;
    if (currentProjectId && right.projectId === currentProjectId) return 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function filterTaskCenterProjects(projects: TaskCenterProject[], status: string) {
  if (status === "all") return projects;
  return projects
    .map((project) => ({ ...project, tasks: project.tasks.filter((task) => task.status === status) }))
    .filter((project) => project.tasks.length > 0);
}

export function taskCenterStatusLabel(status: string) {
  return ({
    compiling_prompt: "提示词编译中",
    compiling: "提示词编译中",
    awaiting_confirmation: "待确认",
    queued: "排队中",
    leased: "已分配",
    dispatching: "派发中",
    running: "生成中",
    generating: "生成中",
    succeeded: "已完成",
    completed: "已完成",
    partially_failed: "部分失败",
    failed: "失败",
    cancelled: "已取消",
    cancel_requested: "正在取消",
    needs_retry: "待重试",
  } as Record<string, string>)[status] ?? status;
}

const ACTIVE_TASK_STATUSES = new Set([
  "incomplete",
  "pending",
  "compiling_prompt",
  "compiling",
  "queued",
  "leased",
  "dispatching",
  "running",
  "generating",
  "cancel_requested",
]);

export function isTaskCenterTaskActive(status: string) {
  return ACTIVE_TASK_STATUSES.has(status);
}

export function hasActiveTaskCenterTasks(projects: TaskCenterProject[]) {
  return projects.some((project) => project.tasks.some((task) => isTaskCenterTaskActive(task.status)));
}

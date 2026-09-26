import type { ApiImageEditTask } from "../api/client";

export function isImageEditTaskActive(status: string) {
  return status === "queued" || status === "generating";
}

type PollOptions = {
  maxAttempts?: number;
  intervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export async function pollImageEditTask(
  initialTask: ApiImageEditTask,
  getTask: (taskId: string) => Promise<ApiImageEditTask>,
  options: PollOptions = {},
) {
  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 1_000;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds)));
  let task = initialTask;

  for (let attempt = 0; isImageEditTaskActive(task.status) && attempt < maxAttempts; attempt += 1) {
    await sleep(intervalMs);
    task = await getTask(task.id);
  }
  return task;
}

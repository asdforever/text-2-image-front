import assert from "node:assert/strict";
import test from "node:test";

import { ReadCache } from "../src/lib/read-cache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

test("concurrent readers share one in-flight request and reuse the fresh value", async () => {
  let calls = 0;
  const pending = deferred<{ value: number }>();
  const cache = new ReadCache({ now: () => 1_000, ttlMs: 5_000 });
  const load = () => {
    calls += 1;
    return pending.promise;
  };

  const first = cache.read("projects", load);
  const second = cache.read("projects", load);
  pending.resolve({ value: 7 });

  assert.strictEqual(await first, await second);
  assert.equal((await cache.read("projects", load)).value, 7);
  assert.equal(calls, 1);
});

test("expired values reload while stale values remain available for background UI", async () => {
  let now = 1_000;
  let calls = 0;
  const cache = new ReadCache({ now: () => now, ttlMs: 100 });
  const load = async () => ({ value: ++calls });

  assert.equal((await cache.read("templates", load)).value, 1);
  now = 1_101;
  assert.deepEqual(cache.peek<{ value: number }>("templates"), { value: 1 });
  assert.equal((await cache.read("templates", load)).value, 2);
  assert.equal(calls, 2);
});

test("invalidation during an in-flight read prevents the stale response from repopulating cache", async () => {
  const firstRequest = deferred<string>();
  let calls = 0;
  const cache = new ReadCache({ ttlMs: 10_000 });
  const load = () => {
    calls += 1;
    return calls === 1 ? firstRequest.promise : Promise.resolve("new");
  };

  const staleRead = cache.read("prompt:one", load);
  cache.invalidate("prompt:one");
  assert.equal(await cache.read("prompt:one", load), "new");
  firstRequest.resolve("old");
  assert.equal(await staleRead, "old");
  assert.equal(cache.peek("prompt:one"), "new");
  assert.equal(calls, 2);
});

test("a failed read is not cached and a later caller can recover", async () => {
  let calls = 0;
  const cache = new ReadCache({ ttlMs: 10_000 });
  const load = async () => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return "recovered";
  };

  await assert.rejects(cache.read("categories", load), /offline/);
  assert.equal(cache.peek("categories"), undefined);
  assert.equal(await cache.read("categories", load), "recovered");
  assert.equal(calls, 2);
});

test("a forced read bypasses a fresh value but still deduplicates forced concurrency", async () => {
  let calls = 0;
  const pending = deferred<number>();
  const cache = new ReadCache({ ttlMs: 10_000 });
  assert.equal(await cache.read("project:one", async () => ++calls), 1);
  const load = () => { calls += 1; return pending.promise; };
  const first = cache.read("project:one", load, undefined, true);
  const second = cache.read("project:one", load, undefined, true);
  pending.resolve(2);
  assert.equal(await first, 2);
  assert.equal(await second, 2);
  assert.equal(calls, 2);
});

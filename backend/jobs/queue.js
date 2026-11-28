// ==========================================================
// JOBS QUEUE (§6.3) — same API: register / add / whenIdle / size
// REDIS_URL → BullMQ (persistent, shared across instances)
// warna in-process Map + setTimeout (dev / tests)
// ==========================================================

const log = require("../utils/logger");

const handlers = new Map();
const localJobs = new Map();
const idleWaiters = [];
const bullQueues = new Map();
const bullWorkers = new Map();

const keyOf = (name, jobId) => `${name}:${jobId}`;

function underNodeTest() {
  return (
    Boolean(process.env.NODE_TEST) ||
    process.execArgv.some((arg) => arg === "--test" || arg.startsWith("--test="))
  );
}

function useBull() {
  // Under `node --test`, stay in-process (whenIdle + no orphan BullMQ workers).
  // Opt in with JOBS_USE_BULL=1 for Redis-backed job integration tests.
  if (underNodeTest() && String(process.env.JOBS_USE_BULL || "") !== "1") {
    return false;
  }
  return Boolean(String(process.env.REDIS_URL || "").trim());
}

function notifyIdle() {
  if (localJobs.size) return;
  while (idleWaiters.length) idleWaiters.shift()();
}

function getConnection() {
  const url = String(process.env.REDIS_URL || "").trim();
  // BullMQ accepts a connection object or URL via ioredis options
  return { url, maxRetriesPerRequest: null };
}

function ensureBull(name) {
  if (bullQueues.has(name)) return bullQueues.get(name);
  const { Queue, Worker } = require("bullmq");
  const connection = getConnection();
  const queue = new Queue(`ce:${name}`, { connection });
  bullQueues.set(name, queue);

  if (!bullWorkers.has(name)) {
    const worker = new Worker(
      `ce:${name}`,
      async (job) => {
        const handler = handlers.get(name);
        if (!handler) throw new Error(`No handler registered for job "${name}"`);
        await handler(job.data, { jobId: job.id, name, attemptsMade: job.attemptsMade });
      },
      { connection, concurrency: 2 },
    );
    worker.on("failed", (job, err) => {
      log.error(`[jobs/bull] ${name} (${job?.id}) failed:`, err?.message || err);
    });
    bullWorkers.set(name, worker);
  }
  return queue;
}

function register(name, handler) {
  if (typeof handler !== "function") throw new Error("queue.register: handler must be a function");
  handlers.set(name, handler);
  if (useBull()) {
    try {
      ensureBull(name);
    } catch (err) {
      log.warn(`[jobs] BullMQ init failed for ${name}, falling back to in-process:`, err?.message || err);
    }
  }
}

async function runLocal(job) {
  const handler = handlers.get(job.name);
  job.state = "running";
  job.attemptsMade += 1;
  try {
    if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
    await handler(job.payload, job);
  } catch (error) {
    if (job.attemptsMade < job.attempts) {
      job.state = "pending";
      const delay = job.backoffMs * 2 ** (job.attemptsMade - 1);
      job.timer = setTimeout(() => runLocal(job), delay);
      job.timer.unref?.();
      return;
    }
    log.error(`[jobs] ${job.name} (${job.jobId}) failed after ${job.attemptsMade} attempt(s):`, error?.message || error);
  }
  if (job.rerun) {
    job.rerun = false;
    job.attemptsMade = 0;
    job.state = "pending";
    setImmediate(() => runLocal(job));
    return;
  }
  localJobs.delete(job.key);
  notifyIdle();
}

/**
 * @param {string} name
 * @param {any} payload
 * @param {{ jobId?: string, attempts?: number, backoffMs?: number, delayMs?: number }} [opts]
 */
async function add(name, payload, opts = {}) {
  const jobId = String(opts.jobId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const attempts = Math.max(1, Number(opts.attempts) || 1);

  if (useBull() && handlers.has(name)) {
    try {
      const queue = ensureBull(name);
      const existing = await queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === "active" || state === "waiting" || state === "delayed") {
          return { queued: false, deduped: true, jobId };
        }
      }
      await queue.add(name, payload, {
        jobId,
        attempts,
        backoff: { type: "exponential", delay: Math.max(1, Number(opts.backoffMs) || 1000) },
        delay: Number(opts.delayMs) > 0 ? Number(opts.delayMs) : undefined,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      return { queued: true, deduped: false, jobId };
    } catch (err) {
      log.warn(`[jobs] BullMQ add failed, in-process fallback:`, err?.message || err);
    }
  }

  const key = keyOf(name, jobId);
  const existing = localJobs.get(key);
  if (existing) {
    if (existing.state === "running") {
      existing.payload = payload;
      existing.rerun = true;
    }
    return { queued: false, deduped: true, jobId };
  }
  const job = {
    key,
    name,
    jobId,
    payload,
    attempts,
    backoffMs: Math.max(1, Number(opts.backoffMs) || 1000),
    attemptsMade: 0,
    state: "pending",
    rerun: false,
    timer: null,
  };
  localJobs.set(key, job);
  if (opts.delayMs > 0) {
    job.timer = setTimeout(() => runLocal(job), opts.delayMs);
    job.timer.unref?.();
  } else {
    setImmediate(() => runLocal(job));
  }
  return { queued: true, deduped: false, jobId };
}

function whenIdle() {
  if (!localJobs.size) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.push(resolve));
}

const size = () => localJobs.size;
const _hasHandler = (name) => handlers.has(name);

async function close() {
  for (const job of localJobs.values()) if (job.timer) clearTimeout(job.timer);
  localJobs.clear();
  for (const worker of bullWorkers.values()) {
    try { await worker.close(); } catch { /* ignore */ }
  }
  for (const queue of bullQueues.values()) {
    try { await queue.close(); } catch { /* ignore */ }
  }
  bullWorkers.clear();
  bullQueues.clear();
  notifyIdle();
}

function _reset() {
  for (const job of localJobs.values()) if (job.timer) clearTimeout(job.timer);
  localJobs.clear();
  handlers.clear();
  notifyIdle();
}

async function ping() {
  if (!useBull()) return { ok: true, driver: "memory" };
  try {
    const redis = require("../middleware/rateLimit").getRedisClient();
    if (!redis) return { ok: false, driver: "bullmq", error: "no redis" };
    const pong = await redis.ping();
    return { ok: pong === "PONG", driver: "bullmq" };
  } catch (err) {
    return { ok: false, driver: "bullmq", error: err?.message || String(err) };
  }
}

module.exports = { register, add, whenIdle, size, close, ping, _hasHandler, _reset };

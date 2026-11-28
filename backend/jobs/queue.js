// ==========================================================
// JOBS QUEUE (optimizeplan.md §6.3) — halka in-process queue
// ----------------------------------------------------------
//   queue.register("translation", async (payload, job) => {...});
//   await queue.add("translation", payload, { jobId, attempts: 3, backoffMs: 1000 });
//
// • Dedupe: wahi jobId pending ho to dobara add nahi hota ({ deduped: true }).
//   Agar wahi jobId abhi RUN ho rahi hai to ek rerun mark hota hai (naya data miss na ho).
// • Retry: fail ho to `attempts` tak setTimeout backoff ke saath dobara.
// • add() sirf "queued" hone par resolve hota hai — handler ka wait nahi (fire-and-forget).
//   Tests / OTP jaisi jagah jahan result chahiye: `queue.whenIdle()`.
// • Process ke andar hai: restart par pending jobs kho jati hain, aur multi-instance par
//   dedupe sirf is process tak.
//
// NEXT STEP: REDIS_URL ho to BullMQ (persistent + shared dedupe + alag worker process) par
// shift karna hai — add()/register() ka interface wahi rakha gaya hai taake callers na badlen.
// Abhi BullMQ workers WIRE NAHI hain (ye sirf scaffolding hai).
// ==========================================================

const log = require("../utils/logger");

const handlers = new Map(); // name -> fn (jobs/email.js, translationService import par register karte hain)
const jobs = new Map(); // jobId -> { state: "pending"|"running", rerun, ... }
const idleWaiters = [];

const keyOf = (name, jobId) => `${name}:${jobId}`;

const notifyIdle = () => {
  if (jobs.size) return;
  while (idleWaiters.length) idleWaiters.shift()();
};

function register(name, handler) {
  if (typeof handler !== "function") throw new Error("queue.register: handler must be a function");
  handlers.set(name, handler);
}

async function run(job) {
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
      job.timer = setTimeout(() => run(job), delay);
      job.timer.unref?.();
      return;
    }
    // Final fail — original request pe koi asar nahi, sirf log
    log.error(`[jobs] ${job.name} (${job.jobId}) failed after ${job.attemptsMade} attempt(s):`, error?.message || error);
  }
  if (job.rerun) {
    // Chalte waqt dobara add hui thi → fresh payload ke saath ek aur baar
    job.rerun = false;
    job.attemptsMade = 0;
    job.state = "pending";
    setImmediate(() => run(job));
    return;
  }
  jobs.delete(job.key);
  notifyIdle();
}

/**
 * @param {string} name
 * @param {any} payload
 * @param {{ jobId?: string, attempts?: number, backoffMs?: number, delayMs?: number }} [opts]
 * @returns {Promise<{ queued: boolean, deduped: boolean, jobId: string }>}
 */
async function add(name, payload, opts = {}) {
  const jobId = String(opts.jobId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const key = keyOf(name, jobId);
  const existing = jobs.get(key);
  if (existing) {
    if (existing.state === "running") {
      existing.payload = payload;
      existing.rerun = true;
    }
    return { queued: false, deduped: true, jobId };
  }
  const job = {
    key, name, jobId, payload,
    attempts: Math.max(1, Number(opts.attempts) || 1),
    backoffMs: Math.max(1, Number(opts.backoffMs) || 1000),
    attemptsMade: 0, state: "pending", rerun: false, timer: null,
  };
  jobs.set(key, job);
  if (opts.delayMs > 0) {
    job.timer = setTimeout(() => run(job), opts.delayMs);
    job.timer.unref?.();
  } else {
    setImmediate(() => run(job));
  }
  return { queued: true, deduped: false, jobId };
}

/** Saari pending/running jobs khatam hone par resolve (tests / graceful shutdown) */
function whenIdle() {
  if (!jobs.size) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.push(resolve));
}

const size = () => jobs.size;
const _hasHandler = (name) => handlers.has(name);

function _reset() {
  for (const job of jobs.values()) if (job.timer) clearTimeout(job.timer);
  jobs.clear();
  handlers.clear();
  notifyIdle();
}

module.exports = { register, add, whenIdle, size, _hasHandler, _reset };

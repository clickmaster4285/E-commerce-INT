const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { SMTP_TIMEOUTS, sendEmail } = require("../utils/sendEmail");

test("SMTP connect, greeting, and idle socket waits are bounded", () => {
  assert.deepEqual(SMTP_TIMEOUTS, {
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
});

test("an SMTP server that accepts TCP but never greets fails fast", async () => {
  const server = net.createServer((socket) => socket.on("error", () => {}));
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const envKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM", "SMTP_SECURE"];
  const oldEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(server.address().port),
    SMTP_USER: "test-user",
    SMTP_PASS: "test-password",
    SMTP_FROM: "test@example.test",
    SMTP_SECURE: "false",
  });
  for (const key of ["EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM"]) delete process.env[key];

  const started = Date.now();
  try {
    await assert.rejects(
      sendEmail({ to: "recipient@example.test", subject: "test", text: "test" }),
      (error) => {
        assert.match(error.message, /Could not connect to the email server/);
        return true;
      },
    );
    assert.ok(Date.now() - started < 15000, "SMTP greeting timeout should keep the request bounded");
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

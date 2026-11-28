// ==========================================================
// JOB WORKERS BOOTSTRAP (§6.3) — register handlers once at startup
// ==========================================================
require("./email");
require("./audit");
require("./stats");
require("./productSummary");

module.exports = require("./queue");

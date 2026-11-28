// ==========================================================
// MIGRATION PATTERN — copy kar ke 002-my-change.js banao
// ----------------------------------------------------------
// exports.up = async ({ dryRun }) => { ... }
//   dryRun === true  → sirf log, DB touch nahi
//   dryRun === false → asli kaam (--apply)
//
// Chalana: node scripts/migrations/run.js          (dry run)
//          node scripts/migrations/run.js --apply   (apply)
// ==========================================================

exports.up = async ({ dryRun }) => {
  console.log(`  001-noop-example: koi DB change nahi (dryRun=${dryRun})`);
};
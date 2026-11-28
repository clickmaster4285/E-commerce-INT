// Express async route wrapper — rejected promises → next(err) (§5.2)
//
// Convention (§5.2 sweep): controller me `catch (error) { res.status(500).json({ message: error.message }) }`
// MAT likho (Mongo internals leak hote hain). Do rasta:
//   1. `asyncHandler(async (req, res) => { ... throw new AppError("msg", { status, code }) })`
//      — baqi errors central middleware/errorHandler.js me log + generic 500.
//   2. Agar try/catch rakhna ho: log.error({ err }, "...") + generic message.
// Converted: contact, page controllers. Baaqi `message: error.message` ka sweep jaari hai
// (`rg "message: (error|err|e)\.message" backend/controllers`).
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

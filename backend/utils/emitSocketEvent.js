const { getIO } = require("./socket");
const log = require("./logger");

function emitSocketEvent(event, data) {
  try {
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (error) {
    log.warn(`Socket emit failed for ${event}:`, error?.message || error);
  }
}

module.exports = { emitSocketEvent };
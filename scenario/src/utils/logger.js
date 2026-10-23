function createLogger(write = console.log) {
  function emit(level, event, details = {}) {
    write(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details
    }));
  }
  return {
    info(event, details) { emit('info', event, details); },
    error(event, details) { emit('error', event, details); }
  };
}
module.exports = { createLogger };

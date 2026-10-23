function createLogger(write = () => {}) {
  function emit(level, event, fields) {
    write({ level, event, timestamp: new Date().toISOString(), ...fields });
  }
  return {
    info(event, fields = {}) { emit('info', event, fields); },
    error(event, fields = {}) { emit('error', event, fields); }
  };
}

module.exports = { createLogger };

const windows = new Map();
const WINDOW_MS = 60_000;
const MAX_RUNS_PER_WINDOW = 24;

function executionRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  let record = windows.get(key);
  if (!record || now - record.startedAt >= WINDOW_MS) {
    record = { startedAt: now, count: 0 };
    windows.set(key, record);
  }
  record.count += 1;
  if (record.count > MAX_RUNS_PER_WINDOW) {
    res.set('Retry-After', String(Math.ceil((record.startedAt + WINDOW_MS - now) / 1000)));
    return res.status(429).json({ error: 'Execution limit reached. Wait a minute, then try again.' });
  }
  if (windows.size > 2000) {
    for (const [address, window] of windows) if (now - window.startedAt >= WINDOW_MS) windows.delete(address);
  }
  next();
}

module.exports = { executionRateLimit };

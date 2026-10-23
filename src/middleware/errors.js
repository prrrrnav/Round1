function errorHandler(err, _req, res, _next) {
  console.error(err.stack || err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
}
module.exports = { errorHandler };

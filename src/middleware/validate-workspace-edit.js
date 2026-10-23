function validateWorkspaceEdit(req, res, next) {
  const relativePath = req.body?.path;
  const content = req.body?.content;
  if (typeof relativePath !== 'string' || typeof content !== 'string') {
    return res.status(400).json({ error: 'A file path and source content are required.' });
  }
  if (content.length > 30000) return res.status(413).json({ error: 'Source files must be smaller than 30 KB.' });
  req.workspaceEdit = { relativePath, content };
  next();
}
module.exports = { validateWorkspaceEdit };

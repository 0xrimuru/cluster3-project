// Shared response helpers: does the caller want JSON (Postman, fetch) or an HTML page?
const wantsJson = req => (req.get('accept') || '').includes('application/json') || !!req.is('application/json') || req.path.startsWith('/api/');

// 404 in the caller's format.
function notFound(req, res, message, nav = '') {
  if (wantsJson(req)) return res.status(404).json({ error: message.replace(/\.$/, '') });
  return res.status(404).render('error', { title: 'Not found', message, nav });
}

module.exports = { wantsJson, notFound };

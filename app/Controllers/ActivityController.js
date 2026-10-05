// ActivityController - the activity log (MongoDB activity_log) for administrators.
// Filters by event type, user name and dates use the collection's indexes.
const Log = require('../Models/NoSql/ActivityLog');

exports.index = async (req, res) => {
  const f = { type: String(req.query.type || ''), user: String(req.query.user || '').trim(), from: String(req.query.from || ''), to: String(req.query.to || '') };
  const dateOk = d => !d || /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!dateOk(f.from)) f.from = '';
  if (!dateOk(f.to)) f.to = '';
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const [events, counts] = await Promise.all([Log.list(Object.assign({ limit }, f)), Log.countsByType(7)]);
  if ((req.get('accept') || '').includes('application/json')) return res.json({ events, counts });
  res.render('activity/index', { title: 'Activity log', pageName: 'Activity', nav: 'more', events, counts, f, types: Log.TYPES });
};

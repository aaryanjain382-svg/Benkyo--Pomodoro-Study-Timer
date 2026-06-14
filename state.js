// GET /api/state?user=NAME  ->  { user, settings, stats }
import { getSettings, getStats, cleanUser } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const user = cleanUser(req.query.user);
    const settings = await getSettings(user);
    const stats = await getStats(user);
    res.status(200).json({ user, settings, stats });
  } catch (err) {
    console.error('GET /api/state failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

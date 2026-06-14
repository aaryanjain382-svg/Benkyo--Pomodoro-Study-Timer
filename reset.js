// POST /api/stats/reset  { user }  ->  { stats }
import { resetStats, getStats, cleanUser } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const user = cleanUser(body.user);
    await resetStats(user);
    const stats = await getStats(user);
    res.status(200).json({ stats });
  } catch (err) {
    console.error('POST /api/stats/reset failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

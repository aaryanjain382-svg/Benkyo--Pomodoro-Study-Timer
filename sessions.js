// POST /api/sessions  { user, mode, seconds, day }  ->  { stats }
import { addSession, getStats, cleanUser } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const user = cleanUser(body.user);
    const { mode = 'focus', seconds = 0, day } = body;
    await addSession(user, mode, seconds, day);
    const stats = await getStats(user);
    res.status(200).json({ stats });
  } catch (err) {
    console.error('POST /api/sessions failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

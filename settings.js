// PUT /api/settings  { user, settings }  ->  { settings }
import { saveSettings, cleanUser } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const user = cleanUser(body.user);
    const settings = await saveSettings(user, body.settings || {});
    res.status(200).json({ settings });
  } catch (err) {
    console.error('PUT /api/settings failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

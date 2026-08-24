import { Router } from 'express';
import { db, getOrCreateUser } from '../db.js';
import { analyzeTranscriptSmart } from '../ai/provider.js';

const router = Router();

// GET /api/transcript/:studentCode -> { records }
router.get('/:studentCode', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE student_code = ?').get(req.params.studentCode);
  if (!user) return res.json({ records: [] });
  const records = db
    .prepare("SELECT course_code as code, status, term FROM transcripts WHERE user_id = ?")
    .all(user.id);
  res.json({ records });
});

// POST /api/transcript { studentCode, email?, courseCode, status, term?, constraints? }
// -> upsert 1 แถว transcript แล้วรัน AI risk analysis (มี rule-based fallback) บนทั้งชุด
router.post('/', async (req, res) => {
  const { studentCode, email, courseCode, status, term, constraints } = req.body ?? {};
  if (!studentCode || !courseCode || !status) {
    return res.status(400).json({ error: 'studentCode, courseCode, status are required' });
  }
  if (!['completed', 'failed', 'withdrawn'].includes(status)) {
    return res.status(400).json({ error: "status must be 'completed' | 'failed' | 'withdrawn'" });
  }

  const user = getOrCreateUser(studentCode, email ?? null);
  db.prepare(
    `INSERT INTO transcripts (user_id, course_code, status, term)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, course_code) DO UPDATE SET status = excluded.status, term = excluded.term, updated_at = datetime('now')`
  ).run(user.id, courseCode, status, term ?? null);

  const records = db
    .prepare("SELECT course_code as code, status, term FROM transcripts WHERE user_id = ?")
    .all(user.id);

  const analysis = await analyzeTranscriptSmart(records, constraints ?? {});
  res.json({ records, analysis });
});

export default router;

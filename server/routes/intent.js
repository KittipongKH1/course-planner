import { Router } from 'express';
import { extractIntentSmart } from '../ai/provider.js';

const router = Router();

// POST /api/intent/extract { text } -> { intent, source: 'ai'|'fallback', error? }
router.post('/extract', async (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text (string) is required' });
  }
  const result = await extractIntentSmart(text);
  res.json(result);
});

export default router;

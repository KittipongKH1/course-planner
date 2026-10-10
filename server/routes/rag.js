import { Router } from 'express';
import { answerQuestion, sanitizeRequest } from '../rag/ragService.js';

const router = Router();

// POST /api/rag/ask { question, history?: [{role, text}], student?: {tracks, plan} }
//   -> { answer, citedIds, sources, source: 'ai'|'fallback'|'no-match', error? }
router.post('/ask', async (req, res) => {
  const request = sanitizeRequest(req.body);
  if (request.error) return res.status(400).json({ error: request.error });
  res.json(await answerQuestion(request));
});

export default router;

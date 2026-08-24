import { Router } from 'express';
import { COURSES, TRACKS } from '../../src/data/curriculum.js';

const router = Router();

router.get('/courses', (req, res) => {
  res.json(COURSES);
});

router.get('/tracks', (req, res) => {
  res.json(Object.values(TRACKS));
});

export default router;

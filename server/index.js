import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './db.js'; // side-effect: opens SQLite + ensures schema exists
import coursesRouter from './routes/courses.js';
import intentRouter from './routes/intent.js';
import transcriptRouter from './routes/transcript.js';
import planRouter from './routes/plan.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', coursesRouter); // /api/courses, /api/tracks
app.use('/api/intent', intentRouter); // /api/intent/extract
app.use('/api/transcript', transcriptRouter); // /api/transcript, /api/transcript/:studentCode
app.use('/api/plan', planRouter); // /api/plan/generate

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Course Planner API listening on http://localhost:${PORT}`);
});

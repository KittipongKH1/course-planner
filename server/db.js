import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, 'data', 'course-planner.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    code TEXT PRIMARY KEY,
    name_th TEXT NOT NULL,
    name_en TEXT NOT NULL,
    credits INTEGER NOT NULL,
    category TEXT NOT NULL,
    term INTEGER,
    load INTEGER NOT NULL DEFAULT 1,
    curriculum_version TEXT NOT NULL DEFAULT '2565'
  );

  CREATE TABLE IF NOT EXISTS prerequisites (
    course_code TEXT NOT NULL REFERENCES courses(code),
    prereq_code TEXT NOT NULL REFERENCES courses(code),
    PRIMARY KEY (course_code, prereq_code)
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS course_tracks (
    course_code TEXT NOT NULL REFERENCES courses(code),
    track_id TEXT NOT NULL REFERENCES tracks(id),
    PRIMARY KEY (course_code, track_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_code TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_code TEXT NOT NULL REFERENCES courses(code),
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'withdrawn')),
    term INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, course_code)
  );

  CREATE TABLE IF NOT EXISTS constraints_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    track TEXT,
    hours_per_week INTEGER,
    honors INTEGER NOT NULL DEFAULT 0,
    grad_school INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS generated_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    method TEXT NOT NULL CHECK (method IN ('ga', 'official', 'greedy')),
    plan_json TEXT NOT NULL,
    warnings_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function getOrCreateUser(studentCode, email = null) {
  const existing = db.prepare('SELECT * FROM users WHERE student_code = ?').get(studentCode);
  if (existing) return existing;
  const result = db
    .prepare('INSERT INTO users (student_code, email) VALUES (?, ?)')
    .run(studentCode, email);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

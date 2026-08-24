// One-time migration: โหลดข้อมูลจาก src/data/curriculum.js (ของเดิม, ไม่แก้ไฟล์นี้)
// เข้า SQLite เพื่อให้ backend ใช้งานได้ — รันด้วย `npm run db:migrate`
import { db } from '../db.js';
import { COURSES, TRACKS } from '../../src/data/curriculum.js';

const CURRICULUM_VERSION = '2565';

function migrate() {
  const insertTrack = db.prepare(
    'INSERT OR REPLACE INTO tracks (id, label, color) VALUES (?, ?, ?)'
  );
  const insertCourse = db.prepare(`
    INSERT OR REPLACE INTO courses (code, name_th, name_en, credits, category, term, load, curriculum_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPrereq = db.prepare(
    'INSERT OR IGNORE INTO prerequisites (course_code, prereq_code) VALUES (?, ?)'
  );
  const insertCourseTrack = db.prepare(
    'INSERT OR IGNORE INTO course_tracks (course_code, track_id) VALUES (?, ?)'
  );
  const deletePrereqsFor = db.prepare('DELETE FROM prerequisites WHERE course_code = ?');
  const deleteTracksFor = db.prepare('DELETE FROM course_tracks WHERE course_code = ?');

  db.exec('BEGIN');
  try {
    Object.values(TRACKS).forEach((t) => insertTrack.run(t.id, t.label, t.color ?? null));

    COURSES.forEach((c) => {
      insertCourse.run(
        c.code,
        c.nameTh,
        c.nameEn,
        c.credits,
        c.category,
        c.term ?? null,
        c.load ?? 1,
        CURRICULUM_VERSION
      );
      deletePrereqsFor.run(c.code);
      (c.prereq ?? []).forEach((p) => insertPrereq.run(c.code, p));
      deleteTracksFor.run(c.code);
      (c.tracks ?? []).forEach((t) => insertCourseTrack.run(c.code, t));
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM courses').get().n;
  console.log(`Migrated ${COURSES.length} courses from curriculum.js -> ${count} rows in DB (curriculum_version=${CURRICULUM_VERSION})`);
  if (count !== COURSES.length) {
    console.warn('WARNING: row count mismatch — check for duplicate course codes in curriculum.js');
  }
}

migrate();

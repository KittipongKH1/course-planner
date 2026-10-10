import { describe, it, expect } from 'vitest';
import { QUIZ_QUESTIONS, TRACK_PROFILES, scoreQuiz } from './careerQuiz.js';
import { TRACKS } from './curriculum.js';

const answerAll = (value, overrides = {}) =>
  Object.fromEntries(QUIZ_QUESTIONS.map((q) => [q.id, overrides[q.id] ?? value]));

describe('career quiz', () => {
  it('has a profile for every track and every track is reachable from some question', () => {
    Object.keys(TRACKS).forEach((id) => {
      expect(TRACK_PROFILES[id]).toBeDefined();
      expect(QUIZ_QUESTIONS.some((q) => q.weights[id] > 0)).toBe(true);
    });
  });

  it('ranks the track matching the strongest answers first, with reasons', () => {
    const [top] = scoreQuiz(answerAll(1, { sec: 5, infra: 3 }));
    expect(top.track).toBe('SECURITY');
    expect(top.reasons[0]).toContain('ช่องโหว่');
  });

  it('does not cite neutral answers as reasons', () => {
    const fullstack = scoreQuiz(answerAll(1, { web: 3 })).find((r) => r.track === 'FULLSTACK');
    expect(fullstack.reasons).toEqual([]);
  });

  it('scores 0 for all-"no" answers and 100 for all-"yes"', () => {
    scoreQuiz(answerAll(1)).forEach((r) => expect(r.score).toBe(0));
    scoreQuiz(answerAll(5)).forEach((r) => expect(r.score).toBe(100));
  });
});

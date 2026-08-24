import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('provider.js — AI call with rule-based fallback', () => {
  beforeEach(() => {
    // ตั้งเป็น fake key ก่อน import เสมอ เพื่อไม่ให้ dotenv โหลดคีย์จริงจาก .env มาปนกับเทสต์
    // (dotenv จะไม่ override ค่าที่ตั้งไว้แล้วใน process.env)
    process.env.API_KEY = 'test-key';
    process.env.KKU_BASE_URL = 'https://gen.ai.kku.ac.th/api/v1';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('extractIntentSmart uses the AI response when the call succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ track: 'AI', hoursPerWeek: 15, honors: true, gradSchool: null, partTimeJob: null }) } }],
      }),
    }));

    const { extractIntentSmart } = await import('./provider.js');
    const { intent, source } = await extractIntentSmart('อยากเป็น AI engineer มีเวลา 15 ชม.');

    expect(source).toBe('ai');
    expect(intent.track).toBe('AI');
    expect(intent.hoursPerWeek).toBe(15);
    expect(intent.honors).toBe(true);
  });

  it('extractIntentSmart falls back to rule-based extraction when the AI call fails (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { extractIntentSmart } = await import('./provider.js');
    const { intent, source, error } = await extractIntentSmart('อยากเป็น DevOps มีเวลาอ่านหนังสือวันละ 2 ชั่วโมง');

    expect(source).toBe('fallback');
    expect(error).toBeTruthy();
    expect(intent.track).toBe('DEVOPS'); // rule-based keyword match still works
    expect(intent.hoursPerWeek).toBe(14); // 2 ชม./วัน * 7
  });

  it('extractIntentSmart falls back when the AI responds with a non-200 status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' }));

    const { extractIntentSmart } = await import('./provider.js');
    const { source } = await extractIntentSmart('อยากเป็น Data Scientist');

    expect(source).toBe('fallback');
  });

  it('extractIntentSmart falls back when API_KEY is not set', async () => {
    delete process.env.API_KEY;
    vi.stubGlobal('fetch', vi.fn());

    const { extractIntentSmart } = await import('./provider.js');
    const { source } = await extractIntentSmart('อยากเป็น Front-end');

    expect(source).toBe('fallback');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('analyzeTranscriptSmart falls back to bottleneck-based rule scoring when AI is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const { analyzeTranscriptSmart } = await import('./provider.js');
    const { result, source } = await analyzeTranscriptSmart(
      [{ code: 'CP351001', status: 'failed' }],
      {}
    );

    expect(source).toBe('fallback');
    expect(['low', 'medium', 'high']).toContain(result.riskLevel);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

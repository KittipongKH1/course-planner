// Low-level client สำหรับ KKUIntelSphere Gen AI Gateway
// OpenAI-compatible API
import 'dotenv/config';

const BASE_URL = process.env.KKU_BASE_URL ?? 'https://gen.ai.kku.ac.th/api/v1';
const API_KEY = process.env.API_KEY ?? '';
// gpt-5-nano ยืนยันแล้วว่าตอบ JSON สะอาด (ไม่ห่อ ```json fence) และมี endpoint พร้อมใช้งานจริงบน gateway นี้
// (ทดสอบ 2026-08-24: gemini-2.5-flash-lite ไม่มี endpoint ให้บริการ, gemini-2.5-flash ใช้ได้แต่ห่อ fence)
const MODEL = process.env.KKU_MODEL ?? 'gpt-5-nano';
const TIMEOUT_MS = 15000;

export class KKUIntelSphereError extends Error {}

/**
 * เรียก chat completion แล้วบังคับให้ตอบเป็น JSON object เดียว
 * @param {{systemPrompt: string, userText: string}} args
 * @returns {Promise<object>} JSON ที่ parse แล้ว
 */
export async function chatJSON({ systemPrompt, userText }) {
  if (!API_KEY) {
    throw new KKUIntelSphereError('API_KEY is not set (.env)');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;

  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new KKUIntelSphereError(
        `KKUIntelSphere request timed out after ${TIMEOUT_MS}ms`
      );
    }

    throw new KKUIntelSphereError(
      `Network error calling KKUIntelSphere: ${err.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new KKUIntelSphereError(
      `KKUIntelSphere responded ${res.status}: ${body.slice(0, 500)}`
    );
  }

  const data = await res.json();

  // เกตเวย์นี้ (คล้าย OpenRouter) บาง endpoint ตอบ HTTP 200 แต่ใส่ error มาใน body แทน เช่น
  // model ที่ระบุใน MODEL ไม่มี provider ให้บริการอยู่ตอนนี้ ("No endpoints found for ...")
  if (data?.error) {
    throw new KKUIntelSphereError(
      `KKUIntelSphere error (model="${MODEL}"): ${data.error.message ?? JSON.stringify(data.error)}`
    );
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new KKUIntelSphereError(
      `Unexpected response shape from KKUIntelSphere: ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  try {
    return JSON.parse(stripMarkdownFence(content));
  } catch {
    throw new KKUIntelSphereError(
      `KKUIntelSphere did not return valid JSON: ${content.slice(0, 500)}`
    );
  }
}

// บางโมเดล (เช่น gemini/claude ที่ผ่านเกตเวย์นี้) ไม่ยึด response_format: json_object เป๊ะ ๆ
// แล้วห่อ JSON ด้วย ```json ... ``` — ตัด fence ออกก่อน parse เพื่อให้ทำงานได้กับหลายโมเดล
function stripMarkdownFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
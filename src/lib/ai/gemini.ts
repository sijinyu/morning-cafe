// Server-only Gemini client — do NOT import from client components
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GOOGLE_GEMINI_API_KEY && typeof window === 'undefined') {
  // Warn at module load time in server context so misconfigured deployments fail fast
  console.warn('[gemini] GOOGLE_GEMINI_API_KEY is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY ?? '');

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    maxOutputTokens: 1024,
    temperature: 0.7,
    topP: 0.9,
  },
});

/** Extracts a JSON string from a Gemini response that may be wrapped in markdown code fences. */
export function extractJson(text: string): string {
  // Strip ```json ... ``` or ``` ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let json = fenced?.[1]?.trim() ?? text.trim();

  // Find the outermost { ... } to handle stray text before/after JSON
  const start = json.indexOf('{');
  const end = json.lastIndexOf('}');
  if (start !== -1 && end > start) {
    json = json.slice(start, end + 1);
  }

  return json;
}

/** Safely parse JSON from Gemini — attempts repair if truncated. */
export function safeParseJson<T>(jsonStr: string): T {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Truncated JSON — attempt to repair by closing open strings/arrays/objects
    let repaired = jsonStr;
    const quoteCount = (repaired.match(/"/g) ?? []).length;
    if (quoteCount % 2 !== 0) repaired += '"';
    if (!repaired.includes(']}')) repaired += ']}';
    if (!repaired.endsWith('}')) repaired += '}';
    return JSON.parse(repaired);
  }
}

/** Returns true when the Gemini API key is configured. */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GEMINI_API_KEY);
}

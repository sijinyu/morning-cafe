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
    maxOutputTokens: 512,
    temperature: 0.7,
    topP: 0.9,
  },
});

/** Extracts a JSON string from a Gemini response that may be wrapped in markdown code fences. */
export function extractJson(text: string): string {
  // Strip ```json ... ``` or ``` ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  // Fallback: trim whitespace and return as-is
  return text.trim();
}

/** Returns true when the Gemini API key is configured. */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GEMINI_API_KEY);
}

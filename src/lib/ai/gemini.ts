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
    responseMimeType: 'application/json',
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

/** Remove trailing commas before } and ] (common Gemini malformation). */
function removeTrailingCommas(s: string): string {
  return s.replace(/,\s*([}\]])/g, '$1');
}

/** Escape raw control characters (newlines, tabs) inside JSON string values. */
function escapeControlCharsInStrings(s: string): string {
  // Walk through the string character-by-character, tracking whether we're
  // inside a JSON string value. When inside a string, replace raw control
  // characters with their escaped equivalents.
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      // Other control chars (0x00-0x1F)
      const code = ch.charCodeAt(0);
      if (code < 0x20) { result += `\\u${code.toString(16).padStart(4, '0')}`; continue; }
    }

    result += ch;
  }

  return result;
}

/** Safely parse JSON from Gemini — attempts repair if truncated or malformed. */
export function safeParseJson<T>(jsonStr: string): T {
  // First try: direct parse
  try {
    return JSON.parse(jsonStr);
  } catch { /* continue to repair */ }

  // Extract outermost {...}
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  let body = start !== -1 && end > start ? jsonStr.slice(start, end + 1) : jsonStr;

  // Second try: extract and re-parse
  try {
    return JSON.parse(body);
  } catch { /* continue to repair */ }

  // Third try: remove trailing commas
  try {
    return JSON.parse(removeTrailingCommas(body));
  } catch { /* continue to repair */ }

  // Fourth try: escape control chars inside strings + remove trailing commas
  try {
    return JSON.parse(removeTrailingCommas(escapeControlCharsInStrings(body)));
  } catch { /* continue to repair */ }

  // Fifth try: aggressive repair for truncated output
  let repaired = removeTrailingCommas(escapeControlCharsInStrings(body));
  // Close unterminated strings
  const quoteCount = (repaired.match(/"/g) ?? []).length;
  if (quoteCount % 2 !== 0) repaired += '"';
  // Balance brackets
  const openBrackets = (repaired.match(/\[/g) ?? []).length;
  const closeBrackets = (repaired.match(/]/g) ?? []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
  const openBraces = (repaired.match(/\{/g) ?? []).length;
  const closeBraces = (repaired.match(/}/g) ?? []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

  // Remove trailing commas again after bracket balancing
  repaired = removeTrailingCommas(repaired);

  return JSON.parse(repaired);
}

/** Returns true when the Gemini API key is configured. */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GEMINI_API_KEY);
}

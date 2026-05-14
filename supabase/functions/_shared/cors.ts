/**
 * CORS headers shared across all Supabase Edge Functions.
 *
 * Every function must respond to OPTIONS preflight requests with these headers
 * before processing the actual request body. Import this module and return a
 * 204 response with these headers for OPTIONS, then include them in every
 * subsequent JSON response.
 */

export const corsHeaders: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
} as const;

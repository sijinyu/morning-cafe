import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface PushTokenBody {
  token: string;
  platform: 'ios' | 'android' | 'web';
  favoriteCafeIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PushTokenBody;

    if (!body.token || !body.platform) {
      return NextResponse.json(
        { error: 'token and platform are required' },
        { status: 400 },
      );
    }

    if (!['ios', 'android', 'web'].includes(body.platform)) {
      return NextResponse.json(
        { error: 'platform must be ios, android, or web' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { error } = await supabase.from('push_tokens').upsert(
      {
        device_token: body.token,
        platform: body.platform,
        favorite_cafe_ids: body.favoriteCafeIds ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'device_token' },
    );

    if (error) {
      console.error('[push-token] Supabase upsert error:', error);
      return NextResponse.json(
        { error: 'Failed to save token' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push-token] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

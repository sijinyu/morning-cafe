import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface ReportBody {
  type: 'hours_correction' | 'new_cafe' | 'closed';
  cafe_name: string | null;
  content: string;
}

export async function POST(request: NextRequest) {
  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, cafe_name, content } = body;

  if (!type || !content?.trim()) {
    return NextResponse.json({ error: 'type and content are required' }, { status: 400 });
  }

  const validTypes = ['hours_correction', 'new_cafe', 'closed'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    const { error } = await supabase.from('reports').insert({
      type,
      cafe_name: cafe_name || null,
      content: content.trim(),
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

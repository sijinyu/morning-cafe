import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'sijinyudev@gmail.com';
const TYPE_LABELS: Record<string, string> = {
  hours_correction: '영업시간 수정',
  new_cafe: '새 카페 제보',
  closed: '폐업 신고',
};

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

    // 관리자에게 이메일 알림 (실패해도 제보 자체는 성공 처리)
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const typeLabel = TYPE_LABELS[type] ?? type;
      const cafeLine = cafe_name ? `카페: ${cafe_name}` : '카페: (미지정)';

      await resend.emails.send({
        from: '모닝커피 <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `[모닝커피 제보] ${typeLabel}${cafe_name ? ` — ${cafe_name}` : ''}`,
        text: `새 제보가 접수되었습니다.\n\n유형: ${typeLabel}\n${cafeLine}\n\n내용:\n${content.trim()}\n\n---\n모닝커피 관리자 알림`,
      }).catch(() => {
        // 이메일 실패는 무시 — 제보는 DB에 저장됨
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

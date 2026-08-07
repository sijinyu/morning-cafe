'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Check, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { useLocalFlag } from '@/lib/hooks/use-local-flag';
import {
  KAKAO_CHANNEL_ID,
  CHANNEL_CTA_DISMISS_KEY,
  kakaoChannelUrl,
} from '@/lib/kakao-channel';
import { cn } from '@/lib/utils';

interface KakaoChannelCtaProps {
  /** GA에서 어느 지면의 전환인지 구분하기 위한 라벨 */
  placement: string;
  /** 닫기 버튼 노출 여부 — 전용 페이지에서는 숨긴다 */
  dismissible?: boolean;
  className?: string;
}

/**
 * 카카오톡 채널 구독 CTA.
 *
 * 채널 ID 미설정 시 렌더하지 않으므로 채널 개설 전에도 안전하게 배포된다.
 * 구독 여부는 SDK가 알려주지 않으므로, 클릭 시점을 "요청됨"으로 간주하고
 * 낙관적 확인 상태를 보여준다.
 */
export function KakaoChannelCta({
  placement,
  dismissible = true,
  className,
}: KakaoChannelCtaProps) {
  const t = useTranslations('channel');
  const [dismissed, dismiss] = useLocalFlag(CHANNEL_CTA_DISMISS_KEY);
  const [requested, setRequested] = useState(false);

  const handleSubscribe = useCallback(() => {
    if (!KAKAO_CHANNEL_ID) return;

    trackEvent('subscribe_channel', { placement });
    setRequested(true);

    const kakao = window.Kakao;
    if (kakao?.isInitialized?.() && kakao.Channel?.addChannel) {
      try {
        kakao.Channel.addChannel({ channelPublicId: KAKAO_CHANNEL_ID });
        return;
      } catch {
        // SDK 실패 시 채널 홈으로 폴백
      }
    }

    window.open(kakaoChannelUrl(KAKAO_CHANNEL_ID), '_blank', 'noopener,noreferrer');
  }, [placement]);

  // 채널 미개설(env 미설정) 또는 이미 닫은 사용자에게는 렌더하지 않는다.
  // SSR 중에는 useLocalFlag가 `true`를 반환하므로 깜빡임도 없다.
  if (!KAKAO_CHANNEL_ID || dismissed) return null;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-red-200/70 bg-red-50/60 p-4',
        'dark:border-red-900/40 dark:bg-red-950/20',
        className,
      )}
    >
      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
          <MessageCircle className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-bold text-foreground">{t('title')}</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={requested}
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-opacity',
          requested
            ? 'bg-muted text-muted-foreground'
            : 'bg-[#FEE500] text-[#191600] hover:opacity-90',
        )}
      >
        {requested ? (
          <>
            <Check className="h-4 w-4" />
            {t('requested')}
          </>
        ) : (
          <>
            <MessageCircle className="h-4 w-4" />
            {t('cta')}
          </>
        )}
      </button>
    </section>
  );
}

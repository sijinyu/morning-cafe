'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MapPinOff, Check, MessageCircle } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { displayCityName, isCoveredCity } from '@/lib/coverage';
import { useGeoCity } from '@/lib/hooks/use-geo-city';
import { useLocalFlag } from '@/lib/hooks/use-local-flag';
import { KAKAO_CHANNEL_ID, kakaoChannelUrl } from '@/lib/kakao-channel';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'mc_region_waitlist_done';

type Status = 'idle' | 'submitting' | 'done' | 'error';

/**
 * 커버리지 밖 방문자에게 보여주는 지역 확장 웨이팅리스트 카드.
 *
 * GA 기준 부산·대전 등에서 유입된 방문자는 데이터가 없어 100% 이탈한다.
 * 버려지던 트래픽을 (1) 카카오톡 채널 구독과 (2) 지역 수요 데이터로 전환한다.
 *
 * 지역 판정은 미들웨어가 심어준 쿠키를 읽는다 — 위치 권한도, 추가 함수 호출도
 * 없다. 커버리지 안이거나 판정 불가(로컬·비Vercel)면 렌더하지 않는다.
 */
export function RegionWaitlist({ className }: { className?: string }) {
  const t = useTranslations('waitlist');
  const locale = useLocale();
  const detectedCity = useGeoCity();
  const [alreadyRequested, markRequested] = useLocalFlag(DISMISS_KEY);
  const [status, setStatus] = useState<Status>('idle');

  const city = detectedCity && !isCoveredCity(detectedCity) ? detectedCity : null;
  // 이전 방문에서 이미 신청했으면 숨긴다. 단, 방금 신청한 확인 메시지는 남긴다.
  const visible = Boolean(city) && (!alreadyRequested || status === 'done');

  useEffect(() => {
    if (!visible || !city) return;
    trackEvent('view_region_waitlist', { region: city });
  }, [visible, city]);

  const handleSubmit = useCallback(async () => {
    if (!city) return;

    setStatus('submitting');
    const willSubscribe = Boolean(KAKAO_CHANNEL_ID);

    try {
      const res = await fetch('/api/region-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: city, subscribedChannel: willSubscribe }),
      });

      if (!res.ok) {
        setStatus('error');
        return;
      }

      trackEvent('join_region_waitlist', { region: city });
      setStatus('done');
      markRequested();

      // 채널이 열려 있으면 구독까지 이어준다 (알림을 실제로 보낼 수단 확보).
      if (KAKAO_CHANNEL_ID) {
        const kakao = window.Kakao;
        if (kakao?.isInitialized?.() && kakao.Channel?.addChannel) {
          try {
            kakao.Channel.addChannel({ channelPublicId: KAKAO_CHANNEL_ID });
            return;
          } catch {
            // 폴백으로 채널 홈을 연다.
          }
        }
        window.open(kakaoChannelUrl(KAKAO_CHANNEL_ID), '_blank', 'noopener,noreferrer');
      }
    } catch {
      setStatus('error');
    }
  }, [city, markRequested]);

  if (!visible || !city) return null;

  const regionLabel = displayCityName(city, locale);

  return (
    <section className={cn('rounded-2xl border border-border bg-muted/40 p-4', className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
          <MapPinOff className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-bold text-foreground">
            {t('title', { region: regionLabel })}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {status === 'done' ? t('doneDescription', { region: regionLabel }) : t('description')}
          </p>
        </div>
      </div>

      {status === 'done' ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-background py-3 text-sm font-semibold text-muted-foreground">
          <Check className="h-4 w-4" />
          {t('done')}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === 'submitting'}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold',
              'bg-foreground text-background transition-opacity hover:opacity-90',
              status === 'submitting' && 'opacity-60',
            )}
          >
            {KAKAO_CHANNEL_ID && <MessageCircle className="h-4 w-4" />}
            {status === 'submitting' ? t('submitting') : t('cta', { region: regionLabel })}
          </button>
          {status === 'error' && (
            <p className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
              {t('error')}
            </p>
          )}
        </>
      )}
    </section>
  );
}

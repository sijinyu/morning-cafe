'use client';

import { useState, useCallback } from 'react';
import { Share2, Check } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { formatOpeningTime } from '@/lib/cafe-utils';
import { isNativeApp } from '@/lib/capacitor';
import type { Cafe } from '@/lib/types/cafe';

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

const BASE_URL = 'https://morning-cafe-phi.vercel.app';

interface CafeShareButtonProps {
  cafe: Cafe;
}

export function CafeShareButton({ cafe }: CafeShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${BASE_URL}/cafe/${cafe.id}`;
  const openTime = cafe.opening_time ? formatOpeningTime(cafe.opening_time) : null;
  const shareTitle = cafe.name;
  const shareText = `${cafe.name} — ${openTime ? `아침 ${openTime} 오픈` : '아침 카페'}\n${cafe.road_address ?? cafe.address}`;

  const handleShare = useCallback(async () => {
    trackEvent('share_cafe', {
      cafe_name: cafe.name,
      cafe_id: cafe.id,
    });

    // 0. Native share (Capacitor)
    if (isNativeApp()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch { /* fallback */ }
    }

    // 1. Try Kakao Share (mobile-optimized Feed template)
    if (typeof window !== 'undefined' && window.Kakao?.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: shareTitle,
            description: shareText,
            imageUrl: `${BASE_URL}/icons/icon-512x512.png`,
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
          buttons: [
            {
              title: '모닝카페에서 보기',
              link: {
                mobileWebUrl: shareUrl,
                webUrl: shareUrl,
              },
            },
          ],
        });
        return;
      } catch {
        // Fallback to Web Share API
      }
    }

    // 2. Try Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or not supported — fallback to clipboard
      }
    }

    // 3. Clipboard fallback
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Final fallback: do nothing
    }
  }, [cafe.id, cafe.name, cafe.road_address, cafe.address, cafe.opening_time, shareTitle, shareText, shareUrl]);

  return (
    <button
      onClick={handleShare}
      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
      aria-label="공유하기"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Share2 className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

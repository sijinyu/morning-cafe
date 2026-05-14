'use client';

import { useState } from 'react';
import { Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface MyLocationButtonProps {
  onLocation: (lat: number, lng: number) => void;
}

export function MyLocationButton({ onLocation }: MyLocationButtonProps) {
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (!navigator.geolocation) {
      toast.error('이 브라우저에서는 위치 기능을 사용할 수 없습니다.');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onLocation(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            toast.error('위치 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.');
            break;
          case err.POSITION_UNAVAILABLE:
            toast.error('현재 위치를 확인할 수 없습니다.');
            break;
          case err.TIMEOUT:
            toast.error('위치 확인 시간이 초과되었습니다.');
            break;
          default:
            toast.error('위치를 가져오는 중 오류가 발생했습니다.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={locating}
      whileTap={{ scale: 0.92 }}
      className={[
        'absolute bottom-6 right-4 z-10 flex h-12 w-12 items-center justify-center',
        'rounded-full bg-background shadow-lg border border-border',
        'transition-opacity disabled:opacity-60',
      ].join(' ')}
      aria-label="현재 위치로 이동"
    >
      <Navigation
        className={[
          'h-5 w-5 text-foreground',
          locating ? 'animate-pulse' : '',
        ].join(' ')}
      />
    </motion.button>
  );
}

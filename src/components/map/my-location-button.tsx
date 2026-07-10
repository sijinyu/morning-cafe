'use client';

import { useState } from 'react';
import { Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface MyLocationButtonProps {
  onLocation: (lat: number, lng: number) => void;
}

export function MyLocationButton({ onLocation }: MyLocationButtonProps) {
  const t = useTranslations('cafe');
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (!navigator.geolocation) return;

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onLocation(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocating(false);
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
        'absolute md:bottom-6 right-4 z-10 flex h-12 w-12 items-center justify-center',
        'rounded-full bg-background/95 backdrop-blur-xl shadow-sm border border-border/60',
        'transition-opacity disabled:opacity-60',
      ].join(' ')}
      style={{ bottom: 'calc(var(--bottom-nav-height) + 1rem)' }}
      aria-label={t('myLocation')}
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

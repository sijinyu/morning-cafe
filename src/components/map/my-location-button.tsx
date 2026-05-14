'use client';

import { useState } from 'react';
import { Navigation } from 'lucide-react';
import { motion } from 'framer-motion';

interface MyLocationButtonProps {
  onLocation: (lat: number, lng: number) => void;
}

export function MyLocationButton({ onLocation }: MyLocationButtonProps) {
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

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  /** 지도 모드: 카페 선택 시 panTo */
  onSelectCafe: (lat: number, lng: number) => void;
  /** 리스트 모드일 때 실시간 검색 쿼리 전달 */
  onQueryChange?: (query: string) => void;
  /** 현재 뷰모드 */
  mode?: 'map' | 'list';
}

export function SearchBar({ onSelectCafe, onQueryChange, mode = 'map' }: SearchBarProps) {
  const cafes = useCafeStore((state) => state.cafes);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isListMode = mode === 'list';

  // 지도 모드: 드롭다운 결과
  const results: Cafe[] = (!isListMode && query.trim().length >= 1)
    ? cafes
        .filter((cafe) =>
          cafe.name.toLowerCase().includes(query.toLowerCase()) ||
          cafe.address.toLowerCase().includes(query.toLowerCase()) ||
          (cafe.road_address?.toLowerCase().includes(query.toLowerCase()) ?? false)
        )
        .slice(0, 5)
    : [];

  const showDropdown = !isListMode && focused && results.length > 0;

  // 리스트 모드: 쿼리 변경 시 부모에 알림
  useEffect(() => {
    if (isListMode) {
      onQueryChange?.(query);
    }
  }, [query, isListMode, onQueryChange]);

  // 모드 전환 시 쿼리 초기화
  useEffect(() => {
    setQuery('');
  }, [mode]);

  const handleSelect = useCallback(
    (cafe: Cafe) => {
      setSelectedCafe(cafe);
      onSelectCafe(cafe.latitude, cafe.longitude);
      setQuery('');
      inputRef.current?.blur();
    },
    [setSelectedCafe, onSelectCafe]
  );

  function handleClear() {
    setQuery('');
    inputRef.current?.focus();
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute top-3 left-1/2 z-20 w-full max-w-sm -translate-x-1/2 px-4"
    >
      {/* Input */}
      <motion.div
        animate={{
          boxShadow: focused
            ? '0 4px 24px rgba(0,0,0,0.12)'
            : '0 2px 8px rgba(0,0,0,0.08)',
        }}
        className={cn(
          'flex items-center gap-2 rounded-2xl',
          'bg-background/90 backdrop-blur-md',
          'border border-border px-4 py-2.5',
          'transition-all'
        )}
      >
        <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={isListMode ? '리스트에서 검색' : '카페명, 지역명 검색'}
          className={cn(
            'flex-1 bg-transparent text-sm text-foreground',
            'placeholder:text-muted-foreground/50',
            'outline-none'
          )}
        />
        <AnimatePresence>
          {query && (
            <motion.button
              key="clear"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={handleClear}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
              aria-label="검색어 지우기"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Dropdown results — 지도 모드에서만 */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'mt-1.5 overflow-hidden rounded-2xl',
              'bg-background/95 backdrop-blur-md',
              'border border-border shadow-lg'
            )}
          >
            {results.map((cafe, idx) => (
              <button
                key={cafe.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => handleSelect(cafe)}
                className={cn(
                  'flex w-full flex-col items-start px-4 py-3',
                  'hover:bg-muted/60 transition-colors text-left',
                  idx !== 0 && 'border-t border-border/50'
                )}
              >
                <span className="text-sm font-medium text-foreground">
                  {cafe.name}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5 truncate w-full">
                  {cafe.road_address ?? cafe.address}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

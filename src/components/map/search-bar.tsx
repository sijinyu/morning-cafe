'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X, Clock, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { useSearchHistory } from '@/lib/hooks/use-search-history';

interface SearchBarProps {
  /** 지도 모드: 카페 선택 시 panTo */
  onSelectCafe: (lat: number, lng: number) => void;
  /** 리스트 모드일 때 실시간 검색 쿼리 전달 */
  onQueryChange?: (query: string) => void;
  /** 현재 뷰모드 */
  mode?: 'map' | 'list';
}

export function SearchBar({ onSelectCafe, onQueryChange, mode = 'map' }: SearchBarProps) {
  const cafes = useCafeStore((state) => state.filteredCafes);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { history, addSearch, removeSearch, clearHistory } = useSearchHistory();

  const isListMode = mode === 'list';

  // 지도 모드: 드롭다운 결과 (useMemo로 캐싱, query/cafes 변경 시에만 재계산)
  const results = useMemo<Cafe[]>(() => {
    if (isListMode || query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    return cafes
      .filter((cafe) =>
        cafe.name.toLowerCase().includes(q) ||
        cafe.address.toLowerCase().includes(q) ||
        (cafe.road_address?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 5);
  }, [cafes, query, isListMode]);

  const showResults = !isListMode && focused && results.length > 0;
  const showHistory = !isListMode && focused && query.trim().length === 0 && history.length > 0;

  // 리스트 모드: 300ms debounce로 부모에 알림 (매 키입력마다 필터링 방지)
  useEffect(() => {
    if (!isListMode) return;
    const timer = setTimeout(() => {
      onQueryChange?.(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, isListMode, onQueryChange]);

  // 모드 전환 시 쿼리 초기화
  useEffect(() => {
    setQuery('');
  }, [mode]);

  const handleSelect = useCallback(
    (cafe: Cafe) => {
      trackEvent('search_select', { cafe_name: cafe.name, query });
      if (query.trim().length >= 2) addSearch(query.trim());
      setSelectedCafe(cafe);
      onSelectCafe(cafe.latitude, cafe.longitude);
      setFocused(false);
      setQuery('');
      inputRef.current?.blur();
    },
    [setSelectedCafe, onSelectCafe, query, addSearch]
  );

  const handleHistorySelect = useCallback(
    (historyQuery: string) => {
      setQuery(historyQuery);
      inputRef.current?.focus();
    },
    []
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
      className="absolute left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4"
      style={{ top: 'calc(0.75rem + var(--safe-area-top))' }}
    >
      {/* Input */}
      <motion.div
        animate={{
          boxShadow: focused
            ? '0 4px 20px rgba(0,0,0,0.10)'
            : '0 2px 12px rgba(0,0,0,0.06)',
        }}
        className={cn(
          'flex items-center gap-2.5 rounded-2xl',
          'bg-background/95 backdrop-blur-xl',
          'border border-border/60 px-4 py-3',
          'transition-all',
          focused && 'border-foreground/15',
        )}
      >
        <Search className="h-[18px] w-[18px] flex-shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={isListMode ? '리스트에서 검색' : '카페명, 지역명 검색'}
          className={cn(
            'flex-1 bg-transparent text-[15px] text-foreground',
            'placeholder:text-muted-foreground/40',
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
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/15 transition-colors"
              aria-label="검색어 지우기"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Dropdown — 검색 결과 또는 검색 기록 */}
      <AnimatePresence>
        {(showResults || showHistory) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'mt-1.5 overflow-hidden rounded-2xl',
              'bg-background/95 backdrop-blur-xl',
              'border border-border/60 shadow-lg'
            )}
          >
            {/* 검색 기록 */}
            {showHistory && (
              <>
                <div className="px-4 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  최근 검색
                </div>
                {history.map((h, idx) => (
                  <div
                    key={h}
                    className={cn(
                      'flex w-full items-center px-4 py-2.5',
                      'hover:bg-muted/60 transition-colors',
                      idx !== 0 && 'border-t border-border/50'
                    )}
                  >
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleHistorySelect(h)}
                      className="flex flex-1 items-center gap-2.5 text-left min-w-0"
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground truncate">{h}</span>
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => removeSearch(h)}
                      className="flex h-8 w-8 items-center justify-center flex-shrink-0 rounded-full hover:bg-muted transition-colors"
                      aria-label="삭제"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearHistory}
                  className="flex w-full items-center justify-center gap-1 px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  검색 기록 삭제
                </button>
              </>
            )}

            {/* 검색 결과 */}
            {showResults && results.map((cafe, idx) => (
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

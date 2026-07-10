'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Clock, MapPin, XCircle, CheckCircle2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

type ReportType = 'hours_correction' | 'new_cafe' | 'closed';

async function saveReport(report: { type: ReportType; cafeName: string | null; content: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: report.type,
        cafe_name: report.cafeName,
        content: report.content,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function ReportPage() {
  const t = useTranslations('report');
  const cafes = useCafeStore((state) => state.cafes);
  const fetchCafes = useCafeStore((state) => state.fetchCafes);

  const REPORT_TYPES: { value: ReportType; label: string; icon: typeof Clock; desc: string }[] = [
    { value: 'hours_correction', label: t('hoursCorrection'), icon: Clock, desc: '영업시간이 실제와 다른 경우' },
    { value: 'new_cafe', label: t('newCafe'), icon: MapPin, desc: '아침 일찍 여는 카페를 알려주세요' },
    { value: 'closed', label: t('closedCafe'), icon: XCircle, desc: '영업을 종료한 카페인 경우' },
  ];

  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [cafeSearch, setCafeSearch] = useState('');
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (cafes.length === 0) fetchCafes();
  }, [cafes.length, fetchCafes]);

  const searchResults = cafeSearch.trim().length >= 1
    ? cafes
        .filter((c) =>
          c.name.toLowerCase().includes(cafeSearch.toLowerCase()) ||
          c.address.toLowerCase().includes(cafeSearch.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const [cafeSearchFocused, setCafeSearchFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reportType || !content.trim() || submitting) return;
    setSubmitting(true);
    const ok = await saveReport({
      type: reportType,
      cafeName: selectedCafe?.name ?? (reportType === 'new_cafe' ? cafeSearch : null),
      content: content.trim(),
    });
    setSubmitting(false);
    if (!ok) return;
    trackEvent('submit_report', { type: reportType });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setReportType(null);
      setSelectedCafe(null);
      setCafeSearch('');
      setContent('');
    }, 2000);
  }

  const needsCafe = reportType === 'hours_correction' || reportType === 'closed';

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4" style={{ paddingTop: 'calc(1rem + var(--safe-area-top))' }}>
        <Send className="h-5 w-5 text-red-500" />
        <h1 className="text-lg font-bold">{t('title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Report type selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t('selectCafe')}</p>
          <div className="grid gap-2">
            {REPORT_TYPES.map(({ value, label, icon: Icon, desc }) => (
              <motion.button
                key={value}
                onClick={() => {
                  setReportType(value);
                  setSelectedCafe(null);
                  setCafeSearch('');
                  setContent('');
                }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all',
                  reportType === value
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 mt-0.5 flex-shrink-0',
                  reportType === value ? 'text-red-500' : 'text-muted-foreground',
                )} />
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {reportType && (
            <motion.div
              key={reportType}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Cafe selection (hours correction / closed) */}
              {needsCafe && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('selectCafe')}</p>
                  {selectedCafe ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-500 bg-red-50 dark:bg-red-950/20 p-3">
                      <MapPin className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{selectedCafe.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedCafe.road_address ?? selectedCafe.address}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedCafe(null); setCafeSearch(''); }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2.5">
                        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <input
                          type="text"
                          value={cafeSearch}
                          onChange={(e) => setCafeSearch(e.target.value)}
                          onFocus={() => setCafeSearchFocused(true)}
                          onBlur={() => { setTimeout(() => setCafeSearchFocused(false), 150); }}
                          placeholder={t('cafeName')}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                        />
                      </div>
                      {cafeSearchFocused && searchResults.length > 0 && (
                        <div className="absolute top-full mt-1 w-full rounded-2xl border border-border bg-background shadow-lg z-10 overflow-hidden">
                          {searchResults.map((cafe, idx) => (
                            <button
                              key={cafe.id}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setSelectedCafe(cafe); setCafeSearch(cafe.name); setCafeSearchFocused(false); }}
                              className={cn(
                                'flex w-full flex-col items-start px-4 py-2.5 hover:bg-muted/60 transition-colors text-left',
                                idx !== 0 && 'border-t border-border/50',
                              )}
                            >
                              <span className="text-sm font-medium">{cafe.name}</span>
                              <span className="text-xs text-muted-foreground truncate w-full">{cafe.road_address ?? cafe.address}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* New cafe name */}
              {reportType === 'new_cafe' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('cafeName')}</p>
                  <input
                    type="text"
                    value={cafeSearch}
                    onChange={(e) => setCafeSearch(e.target.value)}
                    placeholder="카페명과 위치 (예: 동네카페 마포구 연남동)"
                    className="w-full rounded-2xl border border-border px-4 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 focus:border-red-500 transition-colors"
                  />
                </div>
              )}

              {/* Report details */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t('details')}</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t('detailsPlaceholder')}
                  rows={3}
                  className="w-full rounded-2xl border border-border px-4 py-3 text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 focus:border-red-500 transition-colors"
                />
              </div>

              {/* Submit button */}
              <motion.button
                onClick={handleSubmit}
                disabled={!content.trim() || (needsCafe && !selectedCafe) || submitting}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5',
                  'text-sm font-medium transition-all',
                  content.trim() && (!needsCafe || selectedCafe) && !submitting
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? t('submitting') : t('submit')}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <div className="mt-8 border-t border-border pt-6 pb-8 text-center">
          <p className="text-xs text-muted-foreground/80 mb-1">morningcafeapp@gmail.com</p>
          <p className="text-[10px] text-muted-foreground/60">
            제보해주신 내용은 관리자에게 전달됩니다
          </p>
        </div>

        {/* 후원 — Buy Me a Coffee 계정 준비 후 활성화
        <div className="pb-10 text-center">
          <a
            href="https://buymeacoffee.com/sijinyu"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-5 py-3 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
          >
            <span className="text-lg">&#9749;</span>
            응원하기
          </a>
        </div>
        */}

        {/* Success toast */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white shadow-lg"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('success')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

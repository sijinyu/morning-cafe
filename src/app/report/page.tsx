'use client';

import { useState, useEffect } from 'react';
import { Send, Clock, MapPin, XCircle, CheckCircle2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

type ReportType = 'hours_correction' | 'new_cafe' | 'closed';

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof Clock; desc: string }[] = [
  { value: 'hours_correction', label: '영업시간 수정', icon: Clock, desc: '영업시간이 실제와 다른 경우' },
  { value: 'new_cafe', label: '새 카페 제보', icon: MapPin, desc: '아침 일찍 여는 카페를 알려주세요' },
  { value: 'closed', label: '폐업 신고', icon: XCircle, desc: '영업을 종료한 카페인 경우' },
];

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
  const cafes = useCafeStore((state) => state.cafes);
  const fetchCafes = useCafeStore((state) => state.fetchCafes);

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
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Send className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-bold">제보하기</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* 제보 유형 선택 */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">제보 유형을 선택하세요</p>
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
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 mt-0.5 flex-shrink-0',
                  reportType === value ? 'text-amber-500' : 'text-muted-foreground',
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
              {/* 카페 선택 (영업시간 수정/폐업) */}
              {needsCafe && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">카페를 선택하세요</p>
                  {selectedCafe ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3">
                      <MapPin className="h-4 w-4 text-amber-500 flex-shrink-0" />
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
                          placeholder="카페명 또는 주소로 검색"
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                        />
                      </div>
                      {searchResults.length > 0 && (
                        <div className="absolute top-full mt-1 w-full rounded-2xl border border-border bg-background shadow-lg z-10 overflow-hidden">
                          {searchResults.map((cafe, idx) => (
                            <button
                              key={cafe.id}
                              onClick={() => { setSelectedCafe(cafe); setCafeSearch(cafe.name); }}
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

              {/* 새 카페 이름 */}
              {reportType === 'new_cafe' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">카페 정보</p>
                  <input
                    type="text"
                    value={cafeSearch}
                    onChange={(e) => setCafeSearch(e.target.value)}
                    placeholder="카페명과 위치 (예: 동네카페 마포구 연남동)"
                    className="w-full rounded-2xl border border-border px-4 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 focus:border-amber-500 transition-colors"
                  />
                </div>
              )}

              {/* 제보 내용 */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {reportType === 'hours_correction' ? '올바른 영업시간을 알려주세요' :
                   reportType === 'new_cafe' ? '영업시간 및 추가 정보' :
                   '폐업 관련 정보'}
                </p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    reportType === 'hours_correction' ? '예: 월~금 07:00~22:00, 토일 08:00~20:00' :
                    reportType === 'new_cafe' ? '예: 평일 06:30 오픈, 주말 07:00 오픈. 주차 가능' :
                    '예: 2024년 12월부터 폐업 확인'
                  }
                  rows={3}
                  className="w-full rounded-2xl border border-border px-4 py-3 text-sm bg-transparent outline-none resize-none placeholder:text-muted-foreground/50 focus:border-amber-500 transition-colors"
                />
              </div>

              {/* 제출 버튼 */}
              <motion.button
                onClick={handleSubmit}
                disabled={!content.trim() || (needsCafe && !selectedCafe) || submitting}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5',
                  'text-sm font-medium transition-all',
                  content.trim() && (!needsCafe || selectedCafe) && !submitting
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? '보내는 중...' : '제보 보내기'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 만든 사람 */}
        <div className="mt-8 border-t border-border pt-6 pb-8 text-center space-y-1.5">
          <p className="text-xs text-muted-foreground">
            커피를 좋아하는 사람
          </p>
          <p className="text-sm font-medium">유시진</p>
          <a
            href="mailto:sijinyudev@gmail.com"
            className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            sijinyudev@gmail.com
          </a>
          <p className="text-[10px] text-muted-foreground/60 mt-2">
            제보해주신 내용은 관리자에게 전달됩니다
          </p>
        </div>

        {/* 제출 완료 토스트 */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white shadow-lg"
            >
              <CheckCircle2 className="h-4 w-4" />
              제보해주셔서 감사합니다!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

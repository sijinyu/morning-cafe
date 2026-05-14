'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, MapPin, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth-store';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ---- Types ------------------------------------------------------------------

type ReportTab = 'hours' | 'new' | 'closed';

interface Tab {
  value: ReportTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: Tab[] = [
  {
    value: 'hours',
    label: '영업시간 수정',
    icon: Clock,
    description: '잘못된 오픈 시간이나 영업 시간을 수정 제보해주세요',
  },
  {
    value: 'new',
    label: '신규 카페 제보',
    icon: MapPin,
    description: '아직 등록되지 않은 얼리버드 카페를 제보해주세요',
  },
  {
    value: 'closed',
    label: '폐업 신고',
    icon: XCircle,
    description: '폐업한 카페를 신고해주세요',
  },
];

// ---- Cafe search input ------------------------------------------------------

interface CafeSearchInputProps {
  placeholder: string;
  value: string;
  onSelect: (cafe: Cafe) => void;
  onClear: () => void;
  selectedCafe: Cafe | null;
}

function CafeSearchInput({
  placeholder,
  value,
  onSelect,
  onClear,
  selectedCafe,
}: CafeSearchInputProps) {
  const cafes = useCafeStore((state) => state.cafes);
  const [query, setQuery] = useState(value);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (selectedCafe) {
      setQuery(selectedCafe.name);
    }
  }, [selectedCafe]);

  const results: Cafe[] =
    query.trim().length >= 1 && !selectedCafe
      ? cafes
          .filter((cafe) =>
            cafe.name.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 6)
      : [];

  function handleSelect(cafe: Cafe) {
    onSelect(cafe);
    setQuery(cafe.name);
    setShowResults(false);
  }

  function handleClear() {
    setQuery('');
    onClear();
    setShowResults(false);
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-3',
          'focus-within:ring-2 focus-within:ring-ring/40 transition-all'
        )}
      >
        <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
            if (selectedCafe && e.target.value !== selectedCafe.name) {
              onClear();
            }
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
        {(query || selectedCafe) && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          {results.map((cafe, idx) => (
            <button
              key={cafe.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(cafe)}
              className={cn(
                'flex w-full flex-col items-start px-4 py-3 text-left',
                'hover:bg-muted/60 transition-colors',
                idx !== 0 && 'border-t border-border/50'
              )}
            >
              <span className="text-sm font-medium">{cafe.name}</span>
              <span className="text-xs text-muted-foreground truncate w-full">
                {cafe.road_address ?? cafe.address}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Forms ------------------------------------------------------------------

interface HoursFormProps {
  initialCafe: Cafe | null;
}

function HoursForm({ initialCafe }: HoursFormProps) {
  const user = useAuthStore((state) => state.user);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(initialCafe);
  const [correctHours, setCorrectHours] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!selectedCafe) {
      toast.error('카페를 선택해주세요');
      return;
    }
    if (!correctHours.trim()) {
      toast.error('수정할 영업시간을 입력해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reports').insert({
        type: 'hours_correction',
        cafe_id: selectedCafe.id,
        cafe_name: selectedCafe.name,
        user_id: user.id,
        data: { correct_hours: correctHours, note: note.trim() },
      });

      if (error) throw error;

      toast.success('제보해주셔서 감사합니다! 확인 후 반영됩니다');
      setSelectedCafe(null);
      setCorrectHours('');
      setNote('');
    } catch {
      toast.error('제보 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">카페 선택</label>
        <CafeSearchInput
          placeholder="카페명으로 검색"
          value={selectedCafe?.name ?? ''}
          selectedCafe={selectedCafe}
          onSelect={setSelectedCafe}
          onClear={() => setSelectedCafe(null)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          올바른 영업시간
        </label>
        <input
          type="text"
          value={correctHours}
          onChange={(e) => setCorrectHours(e.target.value)}
          placeholder="예: 월~금 06:00 ~ 22:00, 토일 07:00 ~ 21:00"
          className={cn(
            'w-full rounded-2xl border border-border bg-muted/50 px-4 py-3',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
          )}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          추가 메모 <span className="text-muted-foreground font-normal">(선택)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="참고할 내용이 있다면 입력해주세요"
          rows={3}
          className={cn(
            'w-full resize-none rounded-2xl border border-border bg-muted/50 px-4 py-3',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
          )}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !selectedCafe || !correctHours.trim()}
        className={cn(
          'w-full rounded-2xl py-4 text-base font-semibold transition-all',
          'bg-foreground text-background',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        {submitting ? '제출 중...' : '제보하기'}
      </button>
    </form>
  );
}

function NewCafeForm() {
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !address.trim()) {
      toast.error('카페명과 주소는 필수입니다');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reports').insert({
        type: 'new_cafe',
        user_id: user.id,
        cafe_name: name.trim(),
        data: {
          address: address.trim(),
          opening_time: openingTime.trim(),
          note: note.trim(),
        },
      });

      if (error) throw error;

      toast.success('제보해주셔서 감사합니다! 확인 후 반영됩니다');
      setName('');
      setAddress('');
      setOpeningTime('');
      setNote('');
    } catch {
      toast.error('제보 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">카페 이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="카페 이름을 입력해주세요"
          className={cn(
            'w-full rounded-2xl border border-border bg-muted/50 px-4 py-3',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
          )}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">주소</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="도로명 주소 또는 지번 주소"
          className={cn(
            'w-full rounded-2xl border border-border bg-muted/50 px-4 py-3',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
          )}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          오픈 시간 <span className="text-muted-foreground font-normal">(선택)</span>
        </label>
        <input
          type="text"
          value={openingTime}
          onChange={(e) => setOpeningTime(e.target.value)}
          placeholder="예: 06:30"
          className={cn(
            'w-full rounded-2xl border border-border bg-muted/50 px-4 py-3',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
          )}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          추가 메모 <span className="text-muted-foreground font-normal">(선택)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="인스타그램 링크, 출처 등 참고할 내용"
          rows={3}
          className={cn(
            'w-full resize-none rounded-2xl border border-border bg-muted/50 px-4 py-3',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
          )}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim() || !address.trim()}
        className={cn(
          'w-full rounded-2xl py-4 text-base font-semibold transition-all',
          'bg-foreground text-background',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        {submitting ? '제출 중...' : '제보하기'}
      </button>
    </form>
  );
}

interface ClosedFormProps {
  initialCafe: Cafe | null;
}

function ClosedForm({ initialCafe }: ClosedFormProps) {
  const user = useAuthStore((state) => state.user);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(initialCafe);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!selectedCafe) {
      toast.error('카페를 선택해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reports').insert({
        type: 'closed',
        cafe_id: selectedCafe.id,
        cafe_name: selectedCafe.name,
        user_id: user.id,
        data: { note: note.trim() },
      });

      if (error) throw error;

      toast.success('제보해주셔서 감사합니다! 확인 후 반영됩니다');
      setSelectedCafe(null);
      setNote('');
    } catch {
      toast.error('제보 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">폐업한 카페</label>
        <CafeSearchInput
          placeholder="카페명으로 검색"
          value={selectedCafe?.name ?? ''}
          selectedCafe={selectedCafe}
          onSelect={setSelectedCafe}
          onClear={() => setSelectedCafe(null)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          추가 메모 <span className="text-muted-foreground font-normal">(선택)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="폐업 날짜나 참고 사항을 입력해주세요"
          rows={3}
          className={cn(
            'w-full resize-none rounded-2xl border border-border bg-muted/50 px-4 py-3',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
          )}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !selectedCafe}
        className={cn(
          'w-full rounded-2xl py-4 text-base font-semibold transition-all',
          'bg-foreground text-background',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        {submitting ? '제출 중...' : '신고하기'}
      </button>
    </form>
  );
}

// ---- Inner page (uses useSearchParams) ------------------------------------

function ReportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const cafes = useCafeStore((state) => state.cafes);
  const fetchCafes = useCafeStore((state) => state.fetchCafes);

  const [activeTab, setActiveTab] = useState<ReportTab>('hours');

  // Resolve initial cafe from query params (when coming from cafe bottom sheet)
  const initialCafeId = searchParams.get('cafeId');
  const initialCafe = initialCafeId
    ? (cafes.find((c) => c.id === initialCafeId) ?? null)
    : null;

  const loadCafes = useCallback(() => {
    if (cafes.length === 0) {
      fetchCafes();
    }
  }, [cafes.length, fetchCafes]);

  useEffect(() => {
    loadCafes();
  }, [loadCafes]);

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <MapPin className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h1 className="text-xl font-bold">카페 제보</h1>
        <p className="text-sm text-muted-foreground">
          로그인 후 영업시간 수정, 신규 카페 제보,<br />폐업 신고를 할 수 있어요
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-2 rounded-full bg-foreground px-8 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
        >
          카카오로 로그인
        </button>
      </div>
    );
  }

  const activeTabData = TABS.find((t) => t.value === activeTab)!;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">카페 제보</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          정확한 정보를 위해 제보해주세요
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(({ value, label, icon: Icon }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'border border-border bg-background text-muted-foreground hover:border-foreground/30'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form area */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {/* Tab description */}
        <div className="mb-5 rounded-2xl bg-muted/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {activeTabData.description}
          </p>
        </div>

        {activeTab === 'hours' && (
          <HoursForm key="hours" initialCafe={initialCafe} />
        )}
        {activeTab === 'new' && <NewCafeForm key="new" />}
        {activeTab === 'closed' && (
          <ClosedForm key="closed" initialCafe={initialCafe} />
        )}
      </div>
    </div>
  );
}

// ---- Page export ------------------------------------------------------------

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      }
    >
      <ReportPageInner />
    </Suspense>
  );
}

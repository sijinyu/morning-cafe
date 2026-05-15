'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'];

interface HoursSectionProps {
  hoursByDay: Record<string, string> | null;
}

export function HoursSection({ hoursByDay }: HoursSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!hoursByDay || Object.keys(hoursByDay).length === 0) return null;

  const entries = DAY_ORDER
    .filter((day) => day in hoursByDay)
    .map((day) => ({ day, hours: hoursByDay[day] ?? '' }));

  if (entries.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>요일별 영업시간</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-2xl bg-muted/50 px-4 py-3 space-y-1.5">
              {entries.map(({ day, hours }) => (
                <div key={day} className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground w-6">{day}</span>
                  <span className="text-foreground">{hours}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

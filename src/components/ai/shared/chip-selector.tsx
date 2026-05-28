'use client';

import { cn } from '@/lib/utils';

interface ChipSelectorProps<T extends string> {
  label: string;
  options: readonly T[];
  selected: T | T[] | null;
  onChange: (value: T) => void;
  multiple?: boolean;
}

export function ChipSelector<T extends string>({
  label,
  options,
  selected,
  onChange,
  multiple = false,
}: ChipSelectorProps<T>) {
  const isSelected = (option: T): boolean => {
    if (multiple && Array.isArray(selected)) {
      return selected.includes(option);
    }
    return selected === option;
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full px-3.5 py-2 text-[13px] font-medium transition-all',
              isSelected(option)
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

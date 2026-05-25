'use client';

import Image from 'next/image';
import { UtensilsCrossed } from 'lucide-react';
import type { MenuItem } from '@/app/api/place-detail/route';

interface MenuSectionProps {
  menu: MenuItem[];
}

export function MenuSection({ menu }: MenuSectionProps) {
  if (menu.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground">
        <UtensilsCrossed className="h-4 w-4" />
        <span>메뉴</span>
      </div>
      <div className="rounded-2xl bg-muted/50 px-4 py-3 space-y-2">
        {menu.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            {item.photo && (
              <Image
                src={item.photo}
                alt={item.name}
                width={40}
                height={40}
                unoptimized
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
            {item.price && (
              <span className="text-sm font-medium text-foreground/70 flex-shrink-0">{item.price}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

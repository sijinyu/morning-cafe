import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '스탬프 — 모닝커피',
};

export default function StampLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

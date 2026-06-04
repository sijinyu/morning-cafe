import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '최근 본 카페 — 모닝카페',
};

export default function RecentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

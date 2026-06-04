import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '찜 — 모닝카페',
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

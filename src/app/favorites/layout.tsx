import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '즐겨찾기 — 모닝커피',
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

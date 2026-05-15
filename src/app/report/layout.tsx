import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '카페 제보 — 모닝커피',
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

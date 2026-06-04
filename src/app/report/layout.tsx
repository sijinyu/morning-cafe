import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '카페 제보 — 모닝카페',
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

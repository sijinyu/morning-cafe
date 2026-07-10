'use client';

import { Component, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface Props { children: ReactNode }
interface State { hasError: boolean }

function MapErrorFallback({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('map');
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 px-4 text-center">
      <p className="text-sm font-medium text-destructive">{t('loadError')}</p>
      <p className="text-xs text-muted-foreground">{t('loadErrorHint')}</p>
      <button
        onClick={onRetry}
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        {t('refresh')}
      </button>
    </div>
  );
}

export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <MapErrorFallback
          onRetry={() => { this.setState({ hasError: false }); window.location.reload(); }}
        />
      );
    }
    return this.props.children;
  }
}

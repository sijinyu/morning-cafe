'use client';

import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 px-4 text-center">
          <p className="text-sm font-medium text-destructive">지도를 불러올 수 없습니다</p>
          <p className="text-xs text-muted-foreground">카카오맵 서비스에 일시적인 문제가 있습니다</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

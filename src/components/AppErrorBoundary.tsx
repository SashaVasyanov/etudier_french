import { Component, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="app-loading-state app-error-state" role="alert">
            <span className="loading-mark error" aria-hidden="true">!</span>
            <div>
              <span className="eyebrow">Ошибка приложения</span>
              <h1 className="hero-title">Не удалось показать этот экран</h1>
              <p className="hero-text">Локальный прогресс сохранён. Перезапустите экран и продолжите обучение.</p>
            </div>
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              Перезапустить приложение
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

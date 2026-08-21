import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Last line of defence: a thrown render must not become a blank white tab.
 * Drafts live in localStorage — reload usually brings the tree back.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SEJIRE crash", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen">
        <p className="crash-brand">SEJIRE</p>
        <h1>Приложение остановилось</h1>
        <p className="sub">
          Черновик в браузере обычно цел. Обновите страницу. Если ошибка повторяется —
          выгрузите JSON, пока вкладка ещё открыта.
        </p>
        <pre className="crash-detail">{this.state.error.message}</pre>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    );
  }
}

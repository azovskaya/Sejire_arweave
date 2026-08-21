import { Component, type ErrorInfo, type ReactNode } from "react";
import { loadDraftTree } from "../lib/draftStorage";
import { defaultGuide, loadGuide } from "../lib/guide";
import { downloadTreeJson } from "../lib/treeJson";

type Props = { children: ReactNode };
type State = { error: Error | null; exportHint: string | null };

/**
 * Last line of defence: a thrown render must not become a blank white tab.
 * Drafts live in localStorage — reload usually brings the tree back.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, exportHint: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, exportHint: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SEJIRE crash", error, info.componentStack);
  }

  private exportDraft = () => {
    try {
      const store = loadDraftTree();
      if (!store) {
        this.setState({ exportHint: "Черновик в браузере не найден." });
        return;
      }
      downloadTreeJson(store, loadGuide() ?? defaultGuide());
      this.setState({ exportHint: "JSON скачан." });
    } catch (e) {
      this.setState({
        exportHint: e instanceof Error ? e.message : "Не удалось выгрузить JSON",
      });
    }
  };

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
        {this.state.exportHint ? <p className="sub">{this.state.exportHint}</p> : null}
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Обновить
        </button>
        <button type="button" className="btn ghost" onClick={this.exportDraft}>
          Выгрузить JSON
        </button>
      </div>
    );
  }
}

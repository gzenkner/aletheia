import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles.css";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error } as { error: unknown };
  }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      const msg = err instanceof Error ? err.stack || err.message : String(err);
      return (
        <div style={{ padding: 16, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>App crashed during render</div>
          <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

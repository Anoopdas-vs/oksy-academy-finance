import React from "react";

// Catches render/runtime errors in a page so one broken tab shows a
// recoverable message instead of white-screening the whole portal.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep a console trail for debugging; no external reporting yet.
    console.error("Page error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>This section hit an error</h3>
          <p>{String(this.state.error?.message || this.state.error)}</p>
          <button
            className="button primary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}

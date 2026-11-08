import { Component, type ReactNode } from 'react';

/**
 * Last safety net: if a screen crashes, show a calm message with a reload button instead of
 * a blank page. Data on the phone is untouched.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl">Something went wrong on this page.</h1>
        <p className="text-ink-soft">May nagka-problema sa page na ito. Your saved cakes and orders are safe on this phone.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn" onClick={() => window.location.reload()}>Reload / I-reload</button>
          <a className="btn-ghost" href="#/">Home</a>
        </div>
      </div>
    );
  }
}

// One screen failing must not take the whole app down — in front of a customer
// that is the difference between "that screen hiccupped" and a blank phone. The
// boundary shows what broke and a way back; the rest of the app keeps running.
import { Component, type ReactNode } from 'react';

export default class ScreenBoundary extends Component<{ onBack: () => void; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { console.error('Work screen failed:', error); }

  render() {
    if (!this.state.error) return this.props.children;
    // Plain words for the banker; the technical detail goes to the console.
    return (
      <div className="mw-oops" role="alert">
        <div className="mw-oops-t">This screen couldn’t load</div>
        <div className="mw-oops-s">Nothing you saved is lost. Go back and try again — if it keeps happening, tell your support team.</div>
        <button type="button" className="nk-btn tap" onClick={() => { this.setState({ error: null }); this.props.onBack(); }}
          style={{ background: 'var(--nk-brand)', color: '#fff', marginTop: 8 }}>
          Go back
        </button>
      </div>
    );
  }
}

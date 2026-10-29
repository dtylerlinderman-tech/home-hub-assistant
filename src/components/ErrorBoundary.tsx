// If a screen throws while rendering, show a calm message with a Reload button instead of a blank area.
import { Component, type ComponentChildren } from 'preact';
import { Icon } from './Icon';

interface Props { children: ComponentChildren; resetKey: string }
interface State { error: Error | null; key: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Navigating to another screen clears the error.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error): void {
    console.error('Screen crashed', error);
    this.setState({ error });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main class="screen" style={{ alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>
        <Icon name="home" size={48} stroke={1.6} />
        <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>This screen hit a problem</span>
        <span style={{ fontSize: '16px', maxWidth: '520px' }}>{this.state.error.message}</span>
        <button type="button" class="btn" onClick={() => location.reload()}
          style={{ height: '56px', padding: '0 26px', borderRadius: '18px', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: '17px', fontWeight: 800, marginTop: '8px' }}>
          Reload
        </button>
      </main>
    );
  }
}

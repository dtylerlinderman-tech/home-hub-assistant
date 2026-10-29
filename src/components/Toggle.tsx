/** The pill switch from the Meals rules list. The parent button carries role="switch". */
export function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: '52px', height: '30px', flexShrink: 0, borderRadius: '15px', padding: '0 3px',
        background: on ? 'var(--accent)' : 'var(--dashed)', display: 'flex', alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ width: '24px', height: '24px', borderRadius: '12px', background: 'var(--text)' }} />
    </span>
  );
}

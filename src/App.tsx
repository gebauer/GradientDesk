// Placeholder shell; replaced by ui/AppShell.tsx in milestone 3 (docs/BUILD.md).
export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <main style={{ flex: 1, padding: '24px 28px' }}>GradientDesk</main>
      <footer style={{ padding: '8px 28px', fontSize: 12, color: 'var(--text-muted)' }}>
        GradientDesk v{__APP_VERSION__} · Not affiliated with or endorsed by Cytiva. Product names are
        trademarks of their respective owners.
      </footer>
    </div>
  )
}

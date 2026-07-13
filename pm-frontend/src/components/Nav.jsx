function Nav({ page, setPage, hasProject, hasTask }) {
  const tabs = [
    { id: 'dashboard', label: '🏠 Dashboard', enabled: true },
    { id: 'project',   label: '📁 Project',   enabled: hasProject },
    { id: 'board',     label: '🗂 Board',      enabled: hasProject },
    { id: 'task',      label: '📄 Task',       enabled: hasTask }
  ]
  return (
    <nav className="nav">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`nav-tab ${page === t.id ? 'active' : ''}`}
          disabled={!t.enabled}
          onClick={() => setPage(t.id)}
          title={!t.enabled ? 'Load a project first' : ''}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

export default Nav

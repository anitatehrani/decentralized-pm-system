function DashboardPage({
  pForm, setPForm, createProject,
  loadProjectId, setLoadProjectId, loadProject, loadingProject,
  selectedProject, boardTasks, statusMeta, goTo
}) {
  return (
    <div className="grid-2">
      <section className="card">
        <div className="card-header">
          <span className="card-badge project">Project</span>
          <h2>Create Project</h2>
        </div>
        <form onSubmit={createProject} className="form">
          <input placeholder="Project ID" value={pForm.projectId}
            onChange={e => setPForm({ ...pForm, projectId: e.target.value })} required />
          <input placeholder="Name" value={pForm.name}
            onChange={e => setPForm({ ...pForm, name: e.target.value })} required />
          <textarea placeholder="Description" value={pForm.description} rows={2}
            onChange={e => setPForm({ ...pForm, description: e.target.value })} required />
          <input placeholder="Owner ID" value={pForm.ownerId}
            onChange={e => setPForm({ ...pForm, ownerId: e.target.value })} required />
          <button type="submit" className="btn btn-primary">Create Project</button>
        </form>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-badge audit">Load</span>
          <h2>Open Existing Project</h2>
        </div>
        <p className="context-line">Enter a Project ID that already exists on the ledger.</p>
        <div className="load-row">
          <input placeholder="Project ID to load" value={loadProjectId}
            onChange={e => setLoadProjectId(e.target.value)} />
          <button onClick={loadProject} className="btn btn-secondary" disabled={loadingProject}>
            {loadingProject ? '…' : 'Load'}
          </button>
        </div>

        {selectedProject && (
          <div className="preview-card">
            <div className="preview-title">{selectedProject.name}</div>
            <p className="preview-desc">{selectedProject.description}</p>
            <div className="dash-row">
              <span className="pill" style={{
                color: selectedProject.status === 'archived' ? 'var(--text-dim)' : 'var(--success)',
                background: selectedProject.status === 'archived' ? 'rgba(154,160,171,0.12)' : 'rgba(34,197,94,0.12)'
              }}>
                {selectedProject.status}
              </span>
              <span className="context-line" style={{ margin: 0 }}>{selectedProject.members.length} member(s)</span>
            </div>
            <div className="stat-grid">
              {['todo', 'in-progress', 'done'].map(c => (
                <div key={c} className="stat-card">
                  <div className="stat-value" style={{ color: statusMeta[c].color }}>
                    {boardTasks.filter(t => t.status === c).length}
                  </div>
                  <div className="stat-label">{statusMeta[c].label}</div>
                </div>
              ))}
            </div>
            <div className="quick-links">
              <button onClick={() => goTo('project')} className="btn btn-secondary sm">Manage Project →</button>
              <button onClick={() => goTo('board')} className="btn btn-accent sm">Open Board →</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default DashboardPage

function ProjectPage({
  selectedProject, isArchived, archiveProject,
  newMember, setNewMember, addMember,
  loadProjectHistory, loadingProjHistory, showProjectHistory, projectHistory,
  nameMap, displayName, setDisplayName,
  goTo
}) {
  if (!selectedProject) {
    return (
      <section className="card wide">
        <div className="context-line warn">No project loaded yet.</div>
        <button onClick={() => goTo('dashboard')} className="btn btn-primary sm">← Back to Dashboard</button>
      </section>
    )
  }

  return (
    <section className="card wide">
      <div className="card-header">
        <span className="card-badge project">Project</span>
        <h2>{selectedProject.name}</h2>
      </div>

      {isArchived && <div className="archived-banner">📦 This project is archived — read-only</div>}

      <p className="preview-desc">{selectedProject.description}</p>
      <div className="preview-meta">
        <span>Owner <b>{displayName(selectedProject.ownerId)}</b></span>
        <span>Project ID <b className="mono">{selectedProject.projectId}</b></span>
      </div>

      <div className="dash-row">
        <span className="pill" style={{
          color: isArchived ? 'var(--text-dim)' : 'var(--success)',
          background: isArchived ? 'rgba(154,160,171,0.12)' : 'rgba(34,197,94,0.12)'
        }}>
          {selectedProject.status}
        </span>
        <button onClick={archiveProject} className="btn btn-danger sm" disabled={isArchived}>
          Archive Project
        </button>
      </div>

      <div className="divider" />

      <div className="members-block">
        <div className="members-title">👥 Members</div>
        <div className="member-list">
          {selectedProject.members.map(m => (
            <div key={m} className="member-row">
              <span className="pill assignee">{displayName(m)}</span>
              <span className="member-id mono">{m}</span>
              <input
                className="member-name-input"
                placeholder="Add a display name…"
                defaultValue={nameMap[m] || ''}
                onBlur={e => setDisplayName(m, e.target.value.trim())}
              />
            </div>
          ))}
        </div>
        {!isArchived && (
          <form onSubmit={addMember} className="inline-form">
            <input placeholder="New member ID" value={newMember}
              onChange={e => setNewMember(e.target.value)} />
            <button type="submit" className="btn btn-secondary sm">Add Member</button>
          </form>
        )}
      </div>

      <div className="divider" />

      <button onClick={loadProjectHistory} className="btn btn-secondary sm history-toggle" disabled={loadingProjHistory}>
        {loadingProjHistory ? '…' : (showProjectHistory ? 'Refresh Project History' : 'View Project History')}
      </button>

      {showProjectHistory && projectHistory.length > 0 && (
        <div className="timeline compact">
          {[...projectHistory].reverse().map((h, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-dot" style={{ background: h.value.status === 'archived' ? 'var(--text-dim)' : 'var(--success)' }} />
              <div className="timeline-content">
                <div className="timeline-row">
                  <span className="mono tx-id">tx #{projectHistory.length - i}</span>
                  <span className="pill sm" style={{
                    color: h.value.status === 'archived' ? 'var(--text-dim)' : 'var(--success)',
                    background: h.value.status === 'archived' ? 'rgba(154,160,171,0.12)' : 'rgba(34,197,94,0.12)'
                  }}>
                    {h.value.status}
                  </span>
                </div>
                <div className="timeline-meta">
                  members <b>{h.value.members.map(displayName).join(', ')}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default ProjectPage

// Old (pre-role) projects stored members as plain ID strings; new ones store
// {id, role}. This tolerates either shape so past data doesn't crash the UI.
function memberId(m) { return typeof m === 'string' ? m : m.id }
function memberRole(m) { return typeof m === 'string' ? null : m.role }

const AVATAR_PALETTE = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#a855f7', '#22c55e', '#ef4444']
function avatarColor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function ProjectPage({
  selectedProject, isArchived, archiveProject,
  newMember, setNewMember, newMemberRole, setNewMemberRole, addMember,
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
      <div className="preview-meta-chips">
        <span className="meta-chip">Owner <b>{displayName(selectedProject.ownerId)}</b></span>
        <span className="meta-chip">Project ID <b className="mono">{selectedProject.projectId}</b></span>
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
        <div className="members-title">👥 Members <span className="members-count">{selectedProject.members.length}</span></div>
        <div className="member-list">
          {selectedProject.members.map(m => {
            const id = memberId(m)
            const role = memberRole(m)
            const name = displayName(id)
            return (
              <div key={id} className="member-row">
                <div className="member-avatar" style={{ background: avatarColor(id) }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="member-main">
                  <div className="member-name-line">
                    <span className="member-display-name">{name}</span>
                    {role && <span className={`pill sm role-${role}`}>{role}</span>}
                  </div>
                  <span className="member-id mono">ID {id}</span>
                </div>
                <input
                  className="member-name-input"
                  placeholder="Display name…"
                  defaultValue={nameMap[id] || ''}
                  onBlur={e => setDisplayName(id, e.target.value.trim())}
                />
              </div>
            )
          })}
        </div>
        {!isArchived && (
          <div className="add-member-box">
            <div className="add-member-title">Add a new member</div>
            <form onSubmit={addMember} className="inline-form">
              <label className="field-label-inline">
                Member ID
                <input placeholder="e.g. 1234" value={newMember}
                  onChange={e => setNewMember(e.target.value)} />
              </label>
              <label className="field-label-inline role-field">
                Role
                <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)}>
                  <option value="contributor">Contributor</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <button type="submit" className="btn btn-secondary sm">Add Member</button>
            </form>
          </div>
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
                  members <b>{h.value.members.map(m => displayName(memberId(m))).join(', ')}</b>
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
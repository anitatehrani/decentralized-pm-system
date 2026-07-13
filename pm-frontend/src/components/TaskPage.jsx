function TaskPage({
  selectedProject, selectedTask, history,
  loadTaskId, setLoadTaskId, loadTaskAndHistory, loadingTask,
  statusMeta, priorityMeta, columns, updateStatus,
  editMeta, setEditMeta, startEditMeta, saveMeta,
  assignTo, setAssignTo, assignTask,
  uploadFile, setUploadFile, uploadAndAttach, uploading,
  displayName,
  goTo
}) {
  return (
    <section className="card wide">
      <div className="card-header">
        <span className="card-badge audit">Ledger</span>
        <h2>Task Viewer &amp; Audit Trail</h2>
      </div>

      <div className="load-row">
        <input placeholder="Task ID" value={loadTaskId} onChange={e => setLoadTaskId(e.target.value)} />
        <button onClick={loadTaskAndHistory} className="btn btn-accent" disabled={loadingTask}>
          {loadingTask ? 'Loading…' : 'Load Task'}
        </button>
      </div>

      {!selectedTask && (
        <div className="context-line">
          No task selected — load one above, or pick a card from the{' '}
          <button className="link-btn" onClick={() => goTo('board')}>Task Board</button>.
        </div>
      )}

      {selectedTask && (
        <div className="task-detail">
          <div className="task-detail-top">
            {editMeta ? (
              <input className="edit-title-input" value={editMeta.title}
                onChange={e => setEditMeta({ ...editMeta, title: e.target.value })} />
            ) : (
              <h3>{selectedTask.title}</h3>
            )}
            <div className="pills">
              <span className="pill" style={{ color: priorityMeta[selectedTask.priority].color, background: priorityMeta[selectedTask.priority].bg }}>
                {selectedTask.priority}
              </span>
              <span className="pill" style={{ color: statusMeta[selectedTask.status].color, background: statusMeta[selectedTask.status].bg }}>
                {statusMeta[selectedTask.status].label}
              </span>
              {selectedTask.assigneeId && (
                <span className="pill assignee">👤 {displayName(selectedTask.assigneeId)}</span>
              )}
            </div>
          </div>

          {editMeta ? (
            <div className="edit-meta-form">
              <textarea rows={2} value={editMeta.description}
                onChange={e => setEditMeta({ ...editMeta, description: e.target.value })} />
              <select value={editMeta.priority} onChange={e => setEditMeta({ ...editMeta, priority: e.target.value })}>
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
              </select>
              <div className="edit-meta-actions">
                <button onClick={saveMeta} className="btn btn-primary sm">Save Changes</button>
                <button onClick={() => setEditMeta(null)} className="btn btn-secondary sm">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p className="preview-desc">{selectedTask.description}</p>
              {selectedTask.status !== 'done' && (
                <button onClick={startEditMeta} className="btn btn-secondary sm">✎ Edit Details</button>
              )}
            </>
          )}

          <div className="status-buttons">
            {columns.map(s => {
              const isCurrent = selectedTask.status === s
              const transitions = { todo: ['in-progress'], 'in-progress': ['todo', 'done'], done: ['in-progress', 'todo'] }
              const allowed = isCurrent || transitions[selectedTask.status]?.includes(s)
              return (
                <button key={s}
                  onClick={() => updateStatus(selectedTask.taskId, s)}
                  disabled={!allowed}
                  title={!allowed ? 'That move isn’t allowed from the current status' : ''}
                  className={`status-btn ${isCurrent ? 'active' : ''}`}>
                  {statusMeta[s].label}
                </button>
              )
            })}
          </div>

          {selectedTask.status !== 'done' && selectedProject && selectedProject.projectId === selectedTask.projectId && (
            <div className="assign-row">
              <select value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                <option value="">Assign to…</option>
                {selectedProject.members.map(m => <option key={m} value={m}>{displayName(m)}</option>)}
              </select>
              <button onClick={assignTask} className="btn btn-accent sm" disabled={!assignTo}>Assign</button>
            </div>
          )}

          <div className="file-upload">
            <input type="file" onChange={e => setUploadFile(e.target.files[0])}
              id="fileInput" className="file-input" />
            <label htmlFor="fileInput" className="file-label">
              {uploadFile ? uploadFile.name : 'Choose a file'}
            </label>
            <button onClick={uploadAndAttach} disabled={!uploadFile || uploading} className="btn btn-primary">
              {uploading ? 'Uploading to IPFS…' : 'Attach to Task'}
            </button>
          </div>

          {selectedTask.attachments && selectedTask.attachments.length > 0 && (
            <div className="attachments">
              <div className="attachments-title">📎 Attached Files</div>
              {selectedTask.attachments.map((a, i) => (
                <div key={i} className="attachment-item">
                  <span className="attachment-name">{a.fileName}</span>
                  <a href={`http://127.0.0.1:8080/ipfs/${a.cid}`} target="_blank" rel="noreferrer" className="attachment-cid mono">
                    {a.cid.slice(0, 16)}...
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="timeline">
          <div className="timeline-header">
            <span className="lock-icon">🔒</span>
            Immutable Audit Trail — {history.length} on-chain record{history.length > 1 ? 's' : ''}
          </div>
          {[...history].reverse().map((h, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-dot" style={{ background: statusMeta[h.value.status]?.color }} />
              <div className="timeline-content">
                <div className="timeline-row">
                  <span className="mono tx-id">tx #{history.length - i}</span>
                  <span className="pill sm" style={{ color: statusMeta[h.value.status].color, background: statusMeta[h.value.status].bg }}>
                    {statusMeta[h.value.status].label}
                  </span>
                </div>
                <div className="timeline-meta">
                  assignee <b>{h.value.assigneeId ? displayName(h.value.assigneeId) : '—'}</b> · priority <b>{h.value.priority}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default TaskPage

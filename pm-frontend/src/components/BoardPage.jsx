import { useState } from 'react'

// Old (pre-role) projects stored members as plain ID strings; new ones store
// {id, role}. This tolerates either shape so past data doesn't crash the UI.
function memberId(m) { return typeof m === 'string' ? m : m.id }

function BoardPage({
  selectedProject, isArchived,
  tForm, setTForm, createTask,
  addBoardId, setAddBoardId, addExistingTaskToBoard,
  loadingBoard, boardTasks, statusMeta, priorityMeta, columns,
  displayName, updateStatus,
  showArchivedTasks, setShowArchivedTasks,
  openTask, goTo
}) {
  const [dragOverCol, setDragOverCol] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const visibleTasks = boardTasks.filter(t => showArchivedTasks || !t.archived)
  const filteredTasks = visibleTasks.filter(t =>
    (!filterAssignee || t.assigneeId === filterAssignee) &&
    (!filterPriority || t.priority === filterPriority)
  )
  const filtersActive = filterAssignee || filterPriority
  const archivedCount = boardTasks.filter(t => t.archived).length

  function handleDrop(e, col) {
    e.preventDefault()
    setDragOverCol(null)
    const taskId = e.dataTransfer.getData('text/plain') || draggingId
    setDraggingId(null)
    const task = boardTasks.find(t => t.taskId === taskId)
    if (task && task.status !== col) {
      updateStatus(taskId, col)
    }
  }

  if (!selectedProject) {
    return (
      <section className="card wide">
        <div className="context-line warn">No project loaded yet.</div>
        <button onClick={() => goTo('dashboard')} className="btn btn-primary sm">← Back to Dashboard</button>
      </section>
    )
  }

  return (
    <>
      <section className="card wide">
        <div className="card-header">
          <span className="card-badge task">Task</span>
          <h2>Create Task in {selectedProject.name}</h2>
        </div>
        <form onSubmit={createTask} className="form form-row">
          <input placeholder="Task ID" value={tForm.taskId}
            onChange={e => setTForm({ ...tForm, taskId: e.target.value })} required />
          <input placeholder="Title" value={tForm.title}
            onChange={e => setTForm({ ...tForm, title: e.target.value })} required />
          <textarea placeholder="Description" value={tForm.description} rows={1}
            onChange={e => setTForm({ ...tForm, description: e.target.value })} required />
          <select value={tForm.priority} onChange={e => setTForm({ ...tForm, priority: e.target.value })}>
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          <input type="date" title="Due date (optional)" value={tForm.dueDate}
            onChange={e => setTForm({ ...tForm, dueDate: e.target.value })} />
          <button type="submit" className="btn btn-success" disabled={isArchived}>Create Task</button>
        </form>
      </section>

      <section className="card wide">
        <div className="card-header">
          <span className="card-badge project">Board</span>
          <h2>Task Board</h2>
        </div>
        <p className="context-line">Drag a card between columns to change its status.</p>

        <div className="load-row">
          <input placeholder="Add existing Task ID to this board" value={addBoardId}
            onChange={e => setAddBoardId(e.target.value)} />
          <button onClick={addExistingTaskToBoard} className="btn btn-secondary">Add</button>
        </div>

        {boardTasks.length > 0 && (
          <div className="filter-bar">
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
              <option value="">All assignees</option>
              {selectedProject.members.map(m => {
                const id = memberId(m)
                return <option key={id} value={id}>{displayName(id)}</option>
              })}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {filtersActive && (
              <button className="btn btn-secondary sm" onClick={() => { setFilterAssignee(''); setFilterPriority('') }}>
                Clear filters
              </button>
            )}
            {archivedCount > 0 && (
              <button className="btn btn-secondary sm" onClick={() => setShowArchivedTasks(v => !v)}>
                {showArchivedTasks ? 'Hide' : 'Show'} archived ({archivedCount})
              </button>
            )}
          </div>
        )}

        {loadingBoard ? (
          <div className="context-line">Loading tasks…</div>
        ) : boardTasks.length === 0 ? (
          <div className="context-line">No tasks tracked on this board yet — create one above, or add an existing Task ID.</div>
        ) : filteredTasks.length === 0 ? (
          <div className="context-line">No tasks match the current filters.</div>
        ) : (
          <div className="kanban">
            {columns.map(col => (
              <div
                key={col}
                className={`kanban-col ${dragOverCol === col ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col) }}
                onDragLeave={() => setDragOverCol(prev => (prev === col ? null : prev))}
                onDrop={e => handleDrop(e, col)}
              >
                <div className="kanban-col-header" style={{ color: statusMeta[col].color }}>
                  {statusMeta[col].label}
                  <span className="kanban-count">{filteredTasks.filter(t => t.status === col).length}</span>
                </div>
                {filteredTasks.filter(t => t.status === col).map(t => (
                  <div
                    key={t.taskId}
                    className={`kanban-card ${draggingId === t.taskId ? 'dragging' : ''} ${t.archived ? 'archived-card' : ''}`}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', t.taskId)
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggingId(t.taskId)
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                    onClick={() => { openTask(t.taskId); goTo('task') }}
                  >
                    <div className="kanban-card-title">{t.archived ? '🗑 ' : ''}{t.title}</div>
                    <div className="pills">
                      <span className="pill sm" style={{ color: priorityMeta[t.priority].color, background: priorityMeta[t.priority].bg }}>
                        {t.priority}
                      </span>
                      {t.assigneeId && <span className="pill sm assignee">{displayName(t.assigneeId)}</span>}
                      {t.dueDate && <span className="pill sm">📅 {t.dueDate}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export default BoardPage
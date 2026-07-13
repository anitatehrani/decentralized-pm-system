import { useState, useEffect } from 'react'
import './App.css'
import Nav from './components/Nav'
import DashboardPage from './components/DashboardPage'
import ProjectPage from './components/ProjectPage'
import BoardPage from './components/BoardPage'
import TaskPage from './components/TaskPage'

const API = 'http://localhost:3000'

// ── local board-tracking helpers (client-side convenience index over on-chain data) ──
function getBoardIds(projectId) {
  try { return JSON.parse(localStorage.getItem(`pm_board_${projectId}`)) || [] } catch { return [] }
}
function saveBoardIds(projectId, ids) {
  localStorage.setItem(`pm_board_${projectId}`, JSON.stringify([...new Set(ids)]))
}

function App() {
  const [page, setPage] = useState('dashboard')

  const [theme, setTheme] = useState(() => localStorage.getItem('pm_theme') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pm_theme', theme)
  }, [theme])
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [history, setHistory] = useState([])
  const [toasts, setToasts] = useState([])
  const [loadingProject, setLoadingProject] = useState(false)
  const [loadingTask, setLoadingTask] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const [pForm, setPForm] = useState({ projectId: '', name: '', description: '', ownerId: '' })
  const [tForm, setTForm] = useState({ taskId: '', title: '', description: '', priority: 'medium' })
  const [loadProjectId, setLoadProjectId] = useState('')
  const [loadTaskId, setLoadTaskId] = useState('')

  const [boardTasks, setBoardTasks] = useState([])
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [addBoardId, setAddBoardId] = useState('')
  const [newMember, setNewMember] = useState('')
  const [projectHistory, setProjectHistory] = useState([])
  const [showProjectHistory, setShowProjectHistory] = useState(false)
  const [loadingProjHistory, setLoadingProjHistory] = useState(false)

  const [assignTo, setAssignTo] = useState('')
  const [editMeta, setEditMeta] = useState(null)

  // Local, browser-side directory mapping on-chain IDs -> friendly display names.
  // The ledger itself only ever stores/enforces raw IDs; this is purely cosmetic.
  const [nameMap, setNameMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pm_names')) || {} } catch { return {} }
  })
  function setDisplayName(id, name) {
    setNameMap(prev => {
      const next = { ...prev }
      if (name) next[id] = name
      else delete next[id]
      localStorage.setItem('pm_names', JSON.stringify(next))
      return next
    })
  }
  function displayName(id) {
    if (!id) return id
    return nameMap[id] || id
  }

  // Turns raw backend/chaincode error strings into plain, friendly sentences.
  function humanizeError(raw) {
    if (!raw) return 'Something went wrong. Please try again.'
    const rules = [
      [/connect ECONNREFUSED|UNAVAILABLE|No connection established/i,
        () => "Can't reach the blockchain network right now. Make sure the Fabric network and backend are running."],
      [/^Project (.+) already exists$/i,
        (m) => `A project called "${m[1]}" already exists. Try loading it instead of creating it again.`],
      [/^Task (.+) already exists$/i,
        (m) => `A task called "${m[1]}" already exists. Try loading it instead of creating it again.`],
      [/^Project (.+) does not exist$/i,
        (m) => `Couldn't find a project with ID "${m[1]}". Double-check the ID and try again.`],
      [/^Task (.+) does not exist$/i,
        (m) => `Couldn't find a task with ID "${m[1]}". Double-check the ID and try again.`],
      [/^Member (.+) already in project$/i,
        (m) => `"${m[1]}" is already a member of this project.`],
      [/is not a member of project/i,
        () => "That person isn't a member of this project yet — add them as a member first."],
      [/Cannot reassign a completed task/i,
        () => 'This task is already marked Done, so it can’t be reassigned.'],
      [/Cannot edit a completed task/i,
        () => 'This task is already marked Done, so its details can’t be edited.'],
      [/Cannot attach files to a completed task/i,
        () => 'This task is already marked Done, so files can’t be attached anymore.'],
      [/Cannot add tasks to archived project/i,
        () => 'This project is archived, so new tasks can’t be added to it.'],
      [/already archived/i,
        () => 'This project is already archived.'],
      [/already attached to task/i,
        () => 'That file is already attached to this task.'],
      [/^Invalid transition:\s*(\S+)\s*→\s*(\S+)$/i,
        (m) => {
          const label = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }
          const allowedFrom = { todo: ['in-progress'], 'in-progress': ['todo', 'done'], done: ['in-progress', 'todo'] }
          const [, from, to] = m
          const options = (allowedFrom[from] || []).map(s => label[s] || s)
          const suggestion = options.length ? ` From ${label[from] || from}, you can move to ${options.join(' or ')}.` : ''
          return `Can't move this task from ${label[from] || from} to ${label[to] || to}.${suggestion}`
        }],
      [/^Priority must be one of.*$/i,
        () => 'Please choose a valid priority: low, medium, or high.'],
      [/^Status must be one of.*$/i,
        () => 'Please choose a valid status: To Do, In Progress, or Done.'],
      [/^Field must be one of.*$/i,
        () => 'That field can’t be edited — only title, description, and priority can be changed.'],
      [/^Missing: (.+)$/i,
        (m) => `Please fill in: ${m[1]}.`],
    ]
    for (const [pattern, format] of rules) {
      const m = raw.match(pattern)
      if (m) return format(m)
    }
    // Fallback: strip technical prefixes/noise and present the rest plainly
    return raw.replace(/^\d+\s+[A-Z_]+:\s*/, '').replace(/\s*\|.*$/, '').trim()
  }

  const notify = (msg, type = 'success') => {
    const id = Date.now() + Math.random()
    const text = type === 'error' ? humanizeError(msg) : msg
    setToasts(t => [...t, { id, msg: text, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    return id
  }
  const dismissToast = (id) => setToasts(t => t.filter(x => x.id !== id))
  const goTo = (p) => setPage(p)

  function resetTaskContext() {
    setSelectedTask(null)
    setHistory([])
    setEditMeta(null)
    setAssignTo('')
  }

  function patchBoardTask(updated) {
    setBoardTasks(prev => prev.map(t => (t.taskId === updated.taskId ? updated : t)))
  }

  async function refreshBoard(projectId) {
    const ids = getBoardIds(projectId)
    if (ids.length === 0) { setBoardTasks([]); return }
    setLoadingBoard(true)
    const results = await Promise.all(
      ids.map(id => fetch(`${API}/tasks/${id}`).then(r => r.ok ? r.json() : null).catch(() => null))
    )
    setBoardTasks(results.filter(Boolean))
    setLoadingBoard(false)
  }

  async function createProject(e) {
    e.preventDefault()
    const res = await fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pForm)
    })
    const data = await res.json()
    if (res.ok) {
      notify(`Project "${data.name}" created on-chain`)
      setSelectedProject(data)
      setPForm({ projectId: '', name: '', description: '', ownerId: '' })
      resetTaskContext()
      setProjectHistory([]); setShowProjectHistory(false)
      refreshBoard(data.projectId)
      goTo('project')
    } else notify(data.error, 'error')
  }

  async function loadProject() {
    if (!loadProjectId) return
    setLoadingProject(true)
    const res = await fetch(`${API}/projects/${loadProjectId}`)
    const data = await res.json()
    setLoadingProject(false)
    if (res.ok) {
      setSelectedProject(data)
      resetTaskContext()
      setProjectHistory([]); setShowProjectHistory(false)
      refreshBoard(data.projectId)
    } else notify(data.error, 'error')
  }

  async function loadHistory(taskId) {
    const res = await fetch(`${API}/tasks/${taskId}/history`)
    const data = await res.json()
    if (res.ok) setHistory(data)
  }

  async function loadProjectHistory() {
    if (!selectedProject) return
    setLoadingProjHistory(true)
    const res = await fetch(`${API}/projects/${selectedProject.projectId}/history`)
    const data = await res.json()
    setLoadingProjHistory(false)
    if (res.ok) { setProjectHistory(data); setShowProjectHistory(true) }
    else notify(data.error, 'error')
  }

  async function createTask(e) {
    e.preventDefault()
    if (!selectedProject) return notify('Load a project first', 'error')
    const res = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tForm, projectId: selectedProject.projectId })
    })
    const data = await res.json()
    if (res.ok) {
      notify(`Task "${data.title}" created`)
      setTForm({ taskId: '', title: '', description: '', priority: 'medium' })
      saveBoardIds(selectedProject.projectId, [...getBoardIds(selectedProject.projectId), data.taskId])
      setBoardTasks(prev => [...prev, data])
    } else notify(data.error, 'error')
  }

  async function openTask(taskId) {
    if (!taskId) return
    setLoadingTask(true)
    const [taskRes, histRes] = await Promise.all([
      fetch(`${API}/tasks/${taskId}`),
      fetch(`${API}/tasks/${taskId}/history`)
    ])
    const taskData = await taskRes.json()
    const histData = await histRes.json()
    setLoadingTask(false)
    if (taskRes.ok) {
      setSelectedTask(taskData)
      setHistory(histData)
      setEditMeta(null)
      setAssignTo('')
    } else notify(taskData.error, 'error')
  }

  async function loadTaskAndHistory() {
    if (!loadTaskId) return
    await openTask(loadTaskId)
  }

  async function updateStatus(taskId, status) {
    // Optimistic update: move the card / flip the pill instantly, then
    // reconcile with (or roll back to) the real on-chain result once the
    // transaction confirms — avoids waiting on endorsement latency to see
    // the move happen.
    const prevTask = boardTasks.find(t => t.taskId === taskId)
    const prevSelected = selectedTask
    if (prevTask) patchBoardTask({ ...prevTask, status })
    if (selectedTask?.taskId === taskId) setSelectedTask({ ...selectedTask, status })
    const toastId = notify(`Status → ${status}`)

    const res = await fetch(`${API}/tasks/${taskId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    const data = await res.json()
    if (res.ok) {
      patchBoardTask(data)
      if (selectedTask?.taskId === taskId || prevSelected?.taskId === taskId) setSelectedTask(data)
      loadHistory(taskId)
    } else {
      dismissToast(toastId)
      if (prevTask) patchBoardTask(prevTask)
      if (prevSelected?.taskId === taskId) setSelectedTask(prevSelected)
      notify(data.error, 'error')
    }
  }

  async function addMember(e) {
    e.preventDefault()
    if (!newMember || !selectedProject) return
    const res = await fetch(`${API}/projects/${selectedProject.projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: newMember })
    })
    const data = await res.json()
    if (res.ok) {
      setSelectedProject(data)
      notify(`Member "${newMember}" added`)
      setNewMember('')
    } else notify(data.error, 'error')
  }

  async function archiveProject() {
    if (!selectedProject) return
    const res = await fetch(`${API}/projects/${selectedProject.projectId}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { setSelectedProject(data); notify('Project archived') }
    else notify(data.error, 'error')
  }

  async function addExistingTaskToBoard() {
    if (!addBoardId || !selectedProject) return
    const res = await fetch(`${API}/tasks/${addBoardId}`)
    const data = await res.json()
    if (!res.ok) return notify(data.error, 'error')
    if (data.projectId !== selectedProject.projectId) return notify('That task belongs to a different project', 'error')
    saveBoardIds(selectedProject.projectId, [...getBoardIds(selectedProject.projectId), addBoardId])
    setAddBoardId('')
    setBoardTasks(prev => (prev.some(t => t.taskId === data.taskId) ? prev : [...prev, data]))
  }

  async function assignTask() {
    if (!selectedTask || !assignTo) return
    const res = await fetch(`${API}/tasks/${selectedTask.taskId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: assignTo })
    })
    const data = await res.json()
    if (res.ok) {
      setSelectedTask(data)
      patchBoardTask(data)
      notify(`Assigned to ${assignTo}`)
      loadHistory(selectedTask.taskId)
      setAssignTo('')
    } else notify(data.error, 'error')
  }

  function startEditMeta() {
    setEditMeta({ title: selectedTask.title, description: selectedTask.description, priority: selectedTask.priority })
  }

  async function saveMeta() {
    const fields = ['title', 'description', 'priority']
    const changed = fields.filter(f => editMeta[f] !== selectedTask[f])
    if (changed.length === 0) { setEditMeta(null); return }
    let result = selectedTask
    for (const field of changed) {
      const res = await fetch(`${API}/tasks/${selectedTask.taskId}/meta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: editMeta[field] })
      })
      const data = await res.json()
      if (!res.ok) { notify(data.error, 'error'); return }
      result = data
    }
    setSelectedTask(result)
    patchBoardTask(result)
    setEditMeta(null)
    notify('Task updated')
    loadHistory(selectedTask.taskId)
  }

  async function uploadAndAttach() {
    if (!uploadFile || !selectedTask) return notify('Select a file first', 'error')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)

      const ipfsRes = await fetch('http://127.0.0.1:5001/api/v0/add', {
        method: 'POST',
        body: formData
      })
      const ipfsData = await ipfsRes.json()
      const cid = ipfsData.Hash

      const res = await fetch(`${API}/tasks/${selectedTask.taskId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: uploadFile.name, ipfsCid: cid })
      })
      const data = await res.json()
      if (res.ok) {
        setSelectedTask(data)
        notify(`File attached — CID: ${cid.slice(0, 12)}...`)
        setUploadFile(null)
        loadHistory(selectedTask.taskId)
      } else notify(data.error, 'error')
    } catch (err) {
      notify(`Upload failed: ${err.message}`, 'error')
    }
    setUploading(false)
  }

  const statusMeta = {
    'todo':        { color: 'var(--text-dim)',  bg: 'rgba(154,160,171,0.12)', label: 'To Do' },
    'in-progress': { color: 'var(--info)',      bg: 'rgba(59,130,246,0.12)',  label: 'In Progress' },
    'done':        { color: 'var(--success)',   bg: 'rgba(34,197,94,0.12)',   label: 'Done' }
  }
  const priorityMeta = {
    low:    { color: 'var(--text-dim)', bg: 'rgba(154,160,171,0.12)' },
    medium: { color: 'var(--warning)',  bg: 'rgba(245,158,11,0.12)' },
    high:   { color: 'var(--danger)',   bg: 'rgba(239,68,68,0.12)' }
  }
  const columns = ['todo', 'in-progress', 'done']
  const isArchived = selectedProject?.status === 'archived'

  return (
    <div className="app">
      <header className="header">
        <div className="header-icon">⛓</div>
        <div className="header-title">
          <h1>Decentralized PM System</h1>
          <p className="subtitle">Hyperledger Fabric · IPFS · Immutable Audit Trail</p>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} title="Switch theme">
          {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
      </header>

      <Nav page={page} setPage={setPage} hasProject={!!selectedProject} hasTask={!!selectedTask} />

      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-icon">{t.type === 'error' ? '⚠' : '✓'}</span>
            <span className="toast-msg">{t.msg}</span>
            <button className="toast-close" onClick={() => dismissToast(t.id)}>×</button>
            <div className="toast-bar" />
          </div>
        ))}
      </div>

      {page === 'dashboard' && (
        <DashboardPage
          pForm={pForm} setPForm={setPForm} createProject={createProject}
          loadProjectId={loadProjectId} setLoadProjectId={setLoadProjectId}
          loadProject={loadProject} loadingProject={loadingProject}
          selectedProject={selectedProject} boardTasks={boardTasks} statusMeta={statusMeta}
          goTo={goTo}
        />
      )}

      {page === 'project' && (
        <ProjectPage
          selectedProject={selectedProject} isArchived={isArchived} archiveProject={archiveProject}
          newMember={newMember} setNewMember={setNewMember} addMember={addMember}
          loadProjectHistory={loadProjectHistory} loadingProjHistory={loadingProjHistory}
          showProjectHistory={showProjectHistory} projectHistory={projectHistory}
          nameMap={nameMap} displayName={displayName} setDisplayName={setDisplayName}
          goTo={goTo}
        />
      )}

      {page === 'board' && (
        <BoardPage
          selectedProject={selectedProject} isArchived={isArchived}
          tForm={tForm} setTForm={setTForm} createTask={createTask}
          addBoardId={addBoardId} setAddBoardId={setAddBoardId} addExistingTaskToBoard={addExistingTaskToBoard}
          loadingBoard={loadingBoard} boardTasks={boardTasks}
          statusMeta={statusMeta} priorityMeta={priorityMeta} columns={columns}
          displayName={displayName} updateStatus={updateStatus}
          openTask={openTask} goTo={goTo}
        />
      )}

      {page === 'task' && (
        <TaskPage
          selectedProject={selectedProject} selectedTask={selectedTask} history={history}
          loadTaskId={loadTaskId} setLoadTaskId={setLoadTaskId}
          loadTaskAndHistory={loadTaskAndHistory} loadingTask={loadingTask}
          statusMeta={statusMeta} priorityMeta={priorityMeta} columns={columns}
          updateStatus={updateStatus}
          editMeta={editMeta} setEditMeta={setEditMeta} startEditMeta={startEditMeta} saveMeta={saveMeta}
          assignTo={assignTo} setAssignTo={setAssignTo} assignTask={assignTask}
          uploadFile={uploadFile} setUploadFile={setUploadFile} uploadAndAttach={uploadAndAttach} uploading={uploading}
          displayName={displayName}
          goTo={goTo}
        />
      )}
    </div>
  )
}

export default App

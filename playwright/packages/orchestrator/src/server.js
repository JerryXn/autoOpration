const path = require('path')
const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { WebSocketServer } = require('ws')
const { spawn } = require('child_process')
const { Commands, Events, makeMessage } = require('@platform/shared')

const app = express()
app.use(express.json())

const runs = new Map()
const subscribers = new Set()

function broadcast(evt) {
  for (const ws of subscribers) {
    try { ws.send(JSON.stringify(evt)) } catch (_) {}
  }
}

function spawnWorker() {
  const child = spawn(process.execPath, [path.join(__dirname, '../../worker-runtime/src/run.js')], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  })
  child.on('message', (msg) => {
    let runId = null
    for (const r of runs.values()) { if (r.child === child) { runId = r.id; break } }
    broadcast({ pid: child.pid, runId, ...msg })

    if (msg?.type === Events.ERROR) {
      const run = Array.from(runs.values()).find(r => r.child === child)
      if (run && run.retry && run.attempts < run.maxAttempts) {
        run.attempts++
        try { child.kill('SIGKILL') } catch (_) {}
        const nextProxy = run.proxies[run.attempts % run.proxies.length]
        const nextFp = run.fingerprints[run.attempts % run.fingerprints.length]
        const nchild = spawnWorker()
        run.child = nchild
        const merged = { ...run.options, ...(nextFp || {}), proxy: nextProxy || run.options.proxy }
        nchild.send(makeMessage(Commands.START, { scriptPath: run.scriptPath, options: merged }))
      }
    }
  })
  child.on('exit', (code) => {
    broadcast({ type: 'EXIT', payload: { pid: child.pid, code } })
  })

  // 转发子进程的 stdout 和 stderr 到主进程控制台
  child.stdout.on('data', (data) => {
    process.stdout.write(`[Worker ${child.pid}] ${data.toString()}`)
  })
  child.stderr.on('data', (data) => {
    process.stderr.write(`[Worker ${child.pid} ERR] ${data.toString()}`)
  })

  return child
}

app.post('/runs', (req, res) => {
  const id = uuidv4()
  const child = spawnWorker()
  const scriptId = req.body.scriptId || 'example'
  const metaPath = path.join(process.cwd(), 'scripts', scriptId, 'script.json')
  let options = {}
  let entry = 'index.js'
  try {
    const meta = require(metaPath)
    options = meta.defaultOptions || {}
    entry = meta.entry || entry
  } catch (_) {}
  if (req.body.fingerprintId) {
    try {
      const fps = require(path.join(process.cwd(), 'data', 'fingerprints.json'))
      const fp = fps.find(x => x.id === req.body.fingerprintId)
      if (fp) options = { ...options, ...fp }
    } catch (_) {}
  }
  if (req.body.persistLogin) {
    options.persistLogin = true
    if (req.body.persistMode) options.persistMode = req.body.persistMode
    if (req.body.storageKey) options.storageKey = req.body.storageKey
    if (req.body.userDataDir) options.userDataDir = req.body.userDataDir
  }
  const scriptPath = path.join(process.cwd(), 'scripts', scriptId, entry)
  let proxies = []
  let fingerprints = []
  if (req.body.proxyId) {
    try { const ps = require(path.join(process.cwd(), 'data', 'proxies.json')); const p = ps.find(x => x.id === req.body.proxyId); if (p) options.proxy = p } catch (_) {}
  }
  try { proxies = require(path.join(process.cwd(), 'data', 'proxies.json')) } catch (_) {}
  try { fingerprints = require(path.join(process.cwd(), 'data', 'fingerprints.json')) } catch (_) {}
  const opts = { ...options, ...(req.body.options || {}) }
  runs.set(id, { id, pid: child.pid, child, scriptPath, options: opts, proxies, fingerprints, retry: !!req.body.retry, attempts: 0, maxAttempts: req.body.maxAttempts || 2 })
  child.send(makeMessage(Commands.START, { scriptPath, options: opts }))
  res.json({ id, pid: child.pid })
})

app.post('/runs/:id/stop', (req, res) => {
  const run = runs.get(req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  run.child.send(makeMessage(Commands.STOP))
  res.json({ ok: true })
})

app.post('/runs/:id/actions', (req, res) => {
  const run = runs.get(req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  const actions = Array.isArray(req.body.actions) ? req.body.actions : []
  run.child.send(makeMessage(Commands.AGENT_ACTIONS, { actions }))
  res.json({ ok: true })
})

app.post('/runs/:id/pause', (req, res) => {
  const run = runs.get(req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  run.child.send(makeMessage(Commands.PAUSE))
  try { process.kill(run.child.pid, 'SIGSTOP') } catch (_) {}
  res.json({ ok: true })
})

app.post('/runs/:id/resume', (req, res) => {
  const run = runs.get(req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  run.child.send(makeMessage(Commands.RESUME))
  try { process.kill(run.child.pid, 'SIGCONT') } catch (_) {}
  res.json({ ok: true })
})

app.get('/runs/:id/status', (req, res) => {
  const run = runs.get(req.params.id)
  if (!run) return res.status(404).json({ error: 'not found' })
  res.json({ id: run.id, pid: run.pid })
})

const server = app.listen(3000, () => {
  console.log('orchestrator listening on http://localhost:3000')
})

const wss = new WebSocketServer({ server })
wss.on('connection', (ws) => {
  subscribers.add(ws)
  ws.on('close', () => subscribers.delete(ws))
})

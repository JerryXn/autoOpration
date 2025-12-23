const WebSocket = require('ws')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

const ORCH_URL = process.env.ORCH_URL || 'http://localhost:3000'
const WS_URL = process.env.WS_URL || 'ws://localhost:3000'
const MODE = process.env.AGENT_MODE || 'assist'
const LLM_URL = process.env.LLM_API_URL || ''
const LLM_KEY = process.env.LLM_API_KEY || ''
const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini'

const sessions = new Map()

function start() {
  const ws = new WebSocket(WS_URL)
  ws.on('message', async (data) => {
    let msg
    try { msg = JSON.parse(data) } catch (_) { return }
    if (msg.type === 'CHAT_MESSAGE') {
      const sid = findSessionByRun(msg.runId)
      if (!sid) return
      const s = sessions.get(sid)
      s.context.push({ role: 'user', text: msg.payload?.text || '' })
      const plan = await planActions(s, msg)
      if (MODE === 'auto') await dispatchActions(s.runId, plan)
      s.context.push({ role: 'assistant', text: plan?.preview || '' })
    }
  })
}

function findSessionByRun(runId) {
  for (const [sid, s] of sessions.entries()) { if (s.runId === runId) return sid }
  return null
}

async function planActions(session, event) {
  const text = event.payload?.text || ''
  const input = { messages: session.context.slice(-6), last: text }
  let actions = [{ type: 'SEND_MESSAGE', text: text }]
  let preview = text
  if (LLM_URL) {
    try {
      const body = { model: MODEL, input }
      const r = await fetch(LLM_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': LLM_KEY ? `Bearer ${LLM_KEY}` : undefined }, body: JSON.stringify(body) })
      const j = await r.json()
      if (j && Array.isArray(j.actions)) actions = j.actions
      if (j && typeof j.preview === 'string') preview = j.preview
    } catch (_) {}
  }
  return { actions, preview }
}

async function dispatchActions(runId, plan) {
  await fetch(`${ORCH_URL}/runs/${runId}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actions: plan.actions }) })
}

function createSession(runId) {
  const id = `${Date.now()}-${Math.random()}`
  sessions.set(id, { id, runId, context: [] })
  return id
}

module.exports = { start, createSession }

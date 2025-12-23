const Commands = {
  START: 'START',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  STOP: 'STOP',
  STATUS: 'STATUS',
  PING: 'PING',
  AGENT_ACTIONS: 'AGENT_ACTIONS'
}

const Events = {
  READY: 'READY',
  HEARTBEAT: 'HEARTBEAT',
  LOG: 'LOG',
  ERROR: 'ERROR',
  DONE: 'DONE',
  STATE: 'STATE',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  ACTION_RESULT: 'ACTION_RESULT'
}

function makeMessage(type, payload = {}) {
  return { type, payload, ts: Date.now() }
}

module.exports = { Commands, Events, makeMessage }

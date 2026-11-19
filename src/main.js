import './style.css'
import { createBoard, lanes } from './board.js'
import { createTools, defaultOptions } from './tools.js'
import { createSync } from './sync.js'

const byId = (id) => document.getElementById(id)
const views = new Set(['roadmap', 'matrix', 'swot', 'whiteboard', 'decide'])
const demoCards = [
  { title: 'Plan this week', lane: 'today', notes: 'Pick three things to finish.' },
  { title: 'Map out a weekend road trip', lane: 'highway' },
  { title: 'Photograph a new neighbourhood', lane: 'parking' },
  { title: 'Coffee beans', lane: 'shopping' },
  { title: 'Confirm a dinner reservation', lane: 'express' },
  { title: 'Schedule a check-up', lane: 'schedule' },
]
const empty = () => ({ cards: [], marks: [], wheel: defaultOptions })
const demo = () => ({ ...empty(), cards: demoCards.map((card, index) => ({
  id: 'demo-' + index, notes: '', due: '', done: false, ...card,
})) })
const get = () => state

function restore(data) {
  const state = empty()
  if (!data || typeof data !== 'object') return state
  const asText = (value, max) => typeof value === 'string' ? value.slice(0, max) : ''
  if (Array.isArray(data.cards)) {
    state.cards = data.cards.filter((card) => card && Object.hasOwn(lanes, card.lane) &&
      typeof card.id === 'string' && typeof card.title === 'string').map((card) => ({
      id: card.id,
      title: asText(card.title, 160),
      notes: asText(card.notes, 2000),
      done: Boolean(card.done),
      lane: card.lane,
      due: /^\d{4}-\d{2}-\d{2}$/.test(card.due) && !Number.isNaN(Date.parse(card.due)) ? card.due : '',
    }))
  }
  const isPoint = (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
  if (Array.isArray(data.marks)) {
    state.marks = data.marks.filter((mark) => mark && /^#[\da-f]{6}$/i.test(mark.color) &&
      Number.isFinite(mark.size) && mark.size > 0 && mark.size <= 32 && (
      (mark.kind === 'text' && isPoint(mark.point) && typeof mark.text === 'string') ||
      (['pen', 'line'].includes(mark.kind) && Array.isArray(mark.points) && mark.points.length &&
        mark.points.every(isPoint))
    ))
  }
  if (typeof data.wheel === 'string') state.wheel = data.wheel.slice(0, 500)
  return state
}

let state = demo()
let undo = null
const board = createBoard({ get, update, notify })
const tools = createTools({ get, update, notify })

function changeMode(isOwner, nextState) {
  board.reset()
  state = isOwner ? restore(nextState) : demo()
  document.body.dataset.mode = isOwner ? 'owner' : 'demo'
  byId('mode').textContent = isOwner ? 'Dymon mode' : 'Demo mode'
  byId('mode-note').textContent = isOwner ? 'Your workspace saves to your account.' : 'Demo edits reset when you refresh or close the tab.'
  dismiss()
  board.render()
  tools.reset()
}

const sync = createSync({
  get,
  enterOwner: (saved) => changeMode(true, saved),
  enterDemo: () => changeMode(false),
})

function update(change, renderBoard = true) {
  change(state)
  if (renderBoard) board.render()
  sync.changed()
}

function notify(message, restore) {
  byId('status').textContent = message
  undo = restore ?? null
  byId('undo-remove').hidden = !undo
  byId('notice').hidden = false
}

function dismiss() {
  undo = null
  byId('notice').hidden = true
}

function showView(view) {
  for (const name of views) {
    const active = name === view
    byId('panel-' + name).hidden = !active
    const tab = document.querySelector(`[data-view="${name}"]`)
    if (active) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  }
}

function readView() {
  const view = location.hash.slice(1)
  showView(views.has(view) ? view : 'roadmap')
}

for (const tab of document.querySelectorAll('[data-view]')) {
  tab.addEventListener('click', () => {
    showView(tab.dataset.view)
    const url = new URL(location.href)
    url.hash = tab.dataset.view === 'roadmap' ? '' : tab.dataset.view
    history.replaceState(history.state, '', url)
  })
}
window.addEventListener('hashchange', readView)
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => byId(button.dataset.close).close())
}
byId('dismiss').addEventListener('click', dismiss)
byId('undo-remove').addEventListener('click', () => {
  const restore = undo
  dismiss()
  restore?.()
})

board.render()
tools.reset()
readView()

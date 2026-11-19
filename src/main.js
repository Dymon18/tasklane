import './style.css'
import { createBoard, lanes, shoppingCategory } from './board.js'
import { createTools, defaultOptions } from './tools.js'
import { createWhiteboard } from './whiteboard.js'
import { frameworks } from './templates.js'
import { createSync } from './sync.js'

const byId = (id) => document.getElementById(id)
const views = new Set(['matrix', 'roadmap', 'tasks', 'whiteboard', 'decide'])
const spaces = new Map([...document.querySelectorAll('[data-space]')].map((button) =>
  [button.dataset.space, button.textContent.trim()]))
const demoCards = [
  { title: 'Plan this week', lane: 'today', notes: 'Pick three things to finish.' },
  { title: 'Map out a weekend road trip', lane: 'highway' },
  { title: 'Photograph a new neighbourhood', lane: 'parking' },
  { title: 'Coffee beans', lane: 'shopping', shoppingCategory: 'groceries' },
  { title: 'Confirm a dinner reservation', lane: 'express' },
  { title: 'Send the signed forms before lunch', lane: 'express' },
  { title: 'Schedule a check-up', lane: 'schedule' },
  { title: 'Make a short list of weekend hikes', lane: 'schedule' },
  { title: 'Ask someone to pick up the parcel', lane: 'delegate' },
  { title: 'Sort the old app downloads', lane: 'skip' },
]
const empty = () => ({ cards: [], marks: [], frameworkMarks: {}, wheel: defaultOptions })
const otherSpaces = [...spaces.keys()].filter((id) => id !== 'home')
const restoreSpaces = (data) => Object.fromEntries(otherSpaces.map((id) => [id, restoreSpace(data?.[id])]))
const demo = () => ({ ...empty(), spaces: restoreSpaces(), cards: demoCards.map((card, index) => ({
  id: 'demo-' + index, notes: '', due: '', done: false, ...card,
})) })
let activeSpace = 'home'
let activeView = 'matrix'
const get = () => activeSpace === 'home' ? state : state.spaces[activeSpace]

function restoreSpace(data) {
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
      ...(validPosition(card.position) ? { position: { x: card.position.x, y: card.position.y } } : {}),
      ...(card.lane === 'shopping' ? { shoppingCategory: shoppingCategory(card.shoppingCategory) } : {}),
    }))
  }
  const isPoint = (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
  const cleanMarks = (marks) => !Array.isArray(marks) ? [] : marks.filter((mark) =>
    mark && /^#[\da-f]{6}$/i.test(mark.color) &&
      Number.isFinite(mark.size) && mark.size > 0 && mark.size <= 32 && (
      (mark.kind === 'text' && isPoint(mark.point) && typeof mark.text === 'string') ||
      (['pen', 'line', 'erase'].includes(mark.kind) && Array.isArray(mark.points) && mark.points.length &&
        mark.points.every(isPoint))
    ))
  state.marks = cleanMarks(data.marks)
  for (const id of Object.keys(frameworks)) {
    if (id === 'blank') continue
    const marks = cleanMarks(data.frameworkMarks?.[id])
    if (marks.length) state.frameworkMarks[id] = marks
  }
  if (typeof data.wheel === 'string') state.wheel = data.wheel.slice(0, 500)
  return state
}

function validPosition(position) {
  return position && [position.x, position.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
}

function restore(data) {
  const home = restoreSpace(data)
  home.spaces = restoreSpaces(data?.spaces)
  return home
}

let state = demo()
let undo = null
const board = createBoard({ get, update, notify })
const whiteboard = createWhiteboard({ get, update, notify })
const tools = createTools({ get, update })

function changeMode(isOwner, nextState) {
  board.reset()
  state = isOwner ? restore(nextState) : demo()
  document.body.dataset.mode = isOwner ? 'owner' : 'demo'
  byId('mode').textContent = isOwner ? 'Dymon mode' : 'Demo mode'
  byId('mode-note').textContent = isOwner ? 'Your workspace saves to your account.' : 'Demo edits reset when you refresh or close the tab.'
  dismiss()
  board.render()
  whiteboard.reset()
  tools.reset()
}

const sync = createSync({
  get: () => state,
  enterOwner: (saved) => changeMode(true, saved),
  enterDemo: () => changeMode(false),
})

function update(change, renderBoard = true) {
  change(get())
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
  activeView = view
  for (const name of views) {
    const active = name === view
    byId('panel-' + name).hidden = !active
    const tab = document.querySelector(`[data-view="${name}"]`)
    if (active) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  }
  if (view === 'whiteboard') whiteboard.showGallery()
}

function readView() {
  const parts = location.hash.slice(1).split('/')
  const hasSpace = spaces.has(parts[0])
  const space = hasSpace ? parts[0] : 'home'
  const view = hasSpace ? parts[1] : parts[0]
  showSpace(space)
  showView(view === 'swot' ? 'whiteboard' : views.has(view) ? view : 'matrix')
  if (view === 'swot') whiteboard.select('swot')
}

function showSpace(space) {
  if (space === activeSpace) return
  board.reset()
  dismiss()
  activeSpace = space
  byId('active-space').textContent = spaces.get(space)
  for (const button of document.querySelectorAll('[data-space]')) {
    button.setAttribute('aria-pressed', String(button.dataset.space === space))
  }
  board.render()
  whiteboard.showGallery()
  tools.reset()
}

function rememberPage() {
  const url = new URL(location.href)
  url.hash = [activeSpace === 'home' ? '' : activeSpace, activeView === 'matrix' ? '' : activeView]
    .filter(Boolean).join('/')
  history.replaceState(history.state, '', url)
}

const ribbon = byId('ribbon')
const ribbonToggle = byId('ribbon-toggle')
ribbonToggle.addEventListener('click', () => {
  ribbon.hidden = !ribbon.hidden
  byId('desk').classList.toggle('ribbon-hidden', ribbon.hidden)
  ribbonToggle.setAttribute('aria-expanded', String(!ribbon.hidden))
  ribbonToggle.textContent = ribbon.hidden ? 'Show ribbon' : 'Hide ribbon'
})

for (const tab of document.querySelectorAll('[data-view]')) {
  tab.addEventListener('click', () => {
    showView(tab.dataset.view)
    rememberPage()
  })
}
for (const button of document.querySelectorAll('[data-space]')) {
  button.addEventListener('click', () => {
    showSpace(button.dataset.space)
    rememberPage()
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
whiteboard.reset()
tools.reset()
readView()

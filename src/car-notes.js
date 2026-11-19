import { arrangeMatrix, inset, matrixSpace } from './matrix-placement.js'

export const titleLimit = 25
export const whiteboardCarDefault = '#f7dfab'

const carPalette = {
  rose: ['Rose', '#f7c5d3'],
  peach: ['Peach', '#f8ccb3'],
  butter: ['Butter', '#f7e49f'],
  mint: ['Mint', '#c4e7cd'],
  aqua: ['Aqua', '#bfe8e9'],
  sky: ['Sky', '#c9ddfa'],
  lavender: ['Lavender', '#e2cff7'],
  slate: ['Slate', '#dee4e8'],
}

export function carColor(value) {
  return typeof value === 'string' && Object.hasOwn(carPalette, value) ? value : ''
}

export function fillCarColors(fieldset) {
  const swatches = document.createElement('div')
  swatches.className = 'car-color-swatches'
  for (const [value, [name, tint]] of [['', ['Default', 'var(--default-car-tint)']], ...Object.entries(carPalette)]) {
    const swatch = document.createElement('input')
    swatch.type = 'radio'
    swatch.name = 'car-color'
    swatch.value = value
    swatch.defaultChecked = value === ''
    swatch.title = name
    swatch.setAttribute('aria-label', name)
    swatch.style.setProperty('--swatch-tint', tint)
    swatches.append(swatch)
  }
  fieldset.append(swatches)
  return fieldset.form.elements.namedItem('car-color')
}

export function placeNote(note, { x, y }) {
  note.style.setProperty('--note-x', x)
  note.style.setProperty('--note-y', y)
}

export function setPreferredPosition(note, position) {
  note.dataset.positioned = 'true'
  note.dataset.savedX = position.x
  note.dataset.savedY = position.y
  placeNote(note, position)
}

export function renderedPosition(note) {
  const x = note.style.getPropertyValue('--note-x')
  const y = note.style.getPropertyValue('--note-y')
  return x && y ? { x: Number(x), y: Number(y) } : null
}

export function measureMatrix(area) {
  const bounds = area.getBoundingClientRect()
  if (Math.min(bounds.width, bounds.height) <= inset * 2) return null
  const sample = area.querySelector('.task-card')
  const note = sample ?? document.createElement('article')
  if (!sample) {
    note.className = 'task-card'
    note.style.visibility = 'hidden'
    area.append(note)
  }
  const size = Number.parseFloat(getComputedStyle(note).width) || note.offsetWidth
  if (!sample) note.remove()
  return size ? { bounds, space: matrixSpace(bounds.width, bounds.height, size) } : null
}

export function layOutNotes(area) {
  const notes = [...area.querySelectorAll('.task-card')]
  area.style.removeProperty('--packed-note-size')
  if (!notes.length) return
  const geometry = measureMatrix(area)
  if (!geometry) return
  const { bounds, space } = geometry
  const preferred = notes.map((note) => note.dataset.positioned ? {
    x: Number(note.dataset.savedX), y: Number(note.dataset.savedY),
  } : null)
  const { size, positions } = arrangeMatrix(preferred, bounds.width, bounds.height, space.size)
  if (size < space.size) area.style.setProperty('--packed-note-size', size + 'px')
  notes.forEach((note, index) => placeNote(note, positions[index]))
}

export function otherMatrixPositions(area, cardId) {
  return [...area.querySelectorAll('.task-card')].filter((note) => note.dataset.cardId !== cardId)
    .map(renderedPosition).filter(Boolean)
}

export function createCarNote(car, edit, defaultTint = whiteboardCarDefault) {
  const item = document.createElement('article')
  item.className = 'task-card'
  item.dataset.cardId = car.id
  item.style.setProperty('--car', carPalette[carColor(car.color)]?.[1] ?? defaultTint)
  const token = document.createElement('span')
  token.className = 'car-token'
  token.setAttribute('aria-hidden', 'true')
  const content = document.createElement('button')
  content.type = 'button'
  content.className = 'task-content'
  content.setAttribute('aria-label', 'Edit ' + car.title)
  content.addEventListener('click', edit)
  const title = document.createElement('strong')
  title.className = 'task-title'
  title.textContent = car.title
  content.append(title)
  item.append(token, content)
  return { item, content }
}

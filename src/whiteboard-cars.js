import {
  carColor, createCarNote, fillCarColors, layOutNotes, measureMatrix, otherMatrixPositions,
  placeNote, renderedPosition, setPreferredPosition, titleLimit, whiteboardCarDefault,
} from './car-notes.js'
import { clampPosition, findMatrixSpot, fitsMatrix, inset, randomPosition } from './matrix-placement.js'

const byId = (id) => document.getElementById(id)
const noteLimit = 2000

function fromClipboard(text) {
  const [first, ...rest] = text.trim().split(/\r?\n/)
  const heading = first.trim()
  const title = heading.slice(0, titleLimit).replace(/[\uD800-\uDBFF]$/, '').trimEnd()
  const notes = heading.length > titleLimit ? text.trim() : rest.join('\n').trim()
  return { title, notes: notes.slice(0, noteLimit) }
}

export function createWhiteboardCars({ get, update, notify, boardId }) {
  const panel = byId('panel-whiteboard')
  const layer = byId('whiteboard-cars')
  const addButton = byId('whiteboard-car-add')
  const pasteButton = byId('whiteboard-car-paste')
  const dialog = byId('whiteboard-car-editor')
  const form = byId('whiteboard-car-form')
  const heading = byId('whiteboard-car-heading')
  const title = byId('whiteboard-car-title')
  const notes = byId('whiteboard-car-notes')
  const colorField = byId('whiteboard-car-color')
  const colorInput = fillCarColors(colorField)
  colorField.style.setProperty('--default-car-tint', whiteboardCarDefault)
  const fields = byId('whiteboard-car-fields')
  const pasteField = byId('whiteboard-car-paste-field')
  const pasteText = byId('whiteboard-car-paste-text')
  const removeButton = byId('whiteboard-car-remove')
  const copyButton = byId('whiteboard-car-copy')
  const error = byId('whiteboard-car-error')
  const enabled = () => Boolean(boardId()) && !panel.hidden
  let editing = null
  let dragging = null
  let copiedCar = null
  let revision = 0

  function carsFor(state, id = boardId()) {
    return state.frameworkCars[id] ?? []
  }

  function focusCar(id) {
    const item = [...layer.querySelectorAll('.task-card')].find((item) => item.dataset.cardId === id)
    item?.querySelector('button').focus({ preventScroll: true })
  }

  function updateCars(id, change) {
    update((state) => {
      const cars = carsFor(state, id)
      if (boardId() === id) {
        const byId = new Map(cars.map((car) => [car.id, car]))
        for (const item of layer.querySelectorAll('.task-card')) {
          const car = byId.get(item.dataset.cardId)
          const position = renderedPosition(item)
          if (car && position) car.position = position
        }
      }
      change(cars)
      if (cars.length) state.frameworkCars[id] = cars
      else delete state.frameworkCars[id]
    }, false)
    if (boardId() === id) render()
  }

  function render() {
    cancelDrag()
    const items = carsFor(get()).map((car) => {
      const { item, content } = createCarNote(car, () => openEditor(car))
      setPreferredPosition(item, car.position)
      content.setAttribute('aria-description', 'Use arrow keys to move this car.')
      item.addEventListener('pointerdown', (event) => startDrag(event, car, item))
      content.addEventListener('keydown', (event) => nudge(event, car, item))
      return item
    })
    layer.replaceChildren(...items)
    layOutNotes(layer)
  }

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => {
    if (!dragging) layOutNotes(layer)
  }).observe(layer)

  function openEditor(car = null, pasting = false) {
    if (!enabled() || dialog.open) return
    revision++
    editing = car
    form.reset()
    heading.textContent = pasting ? 'Paste car' : car ? 'Edit car' : 'Add car'
    fields.hidden = pasting
    title.disabled = notes.disabled = pasting
    pasteField.hidden = !pasting
    pasteText.disabled = !pasting
    removeButton.hidden = copyButton.hidden = !car
    title.value = car?.title ?? ''
    notes.value = car?.notes ?? ''
    colorInput.value = carColor(car?.color)
    error.textContent = ''
    dialog.showModal()
    const firstField = pasting ? pasteText : title
    firstField.focus()
  }

  function add(values) {
    const id = boardId()
    const geometry = measureMatrix(layer)
    const position = (geometry && findMatrixSpot(otherMatrixPositions(layer), geometry.space, true)) ?? randomPosition()
    const car = { id: crypto.randomUUID(), position, ...values }
    updateCars(id, (cars) => cars.push(car))
    focusCar(car.id)
  }

  function addPasted(text) {
    const color = text === copiedCar?.text ? copiedCar.color : ''
    add({ ...fromClipboard(text), color })
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!enabled()) return
    const values = pasteField.hidden ? { title: title.value.trim(), notes: notes.value.trim() }
      : fromClipboard(pasteText.value)
    if (!values.title || values.title.length > titleLimit) {
      error.textContent = 'Enter a title up to 25 characters.'
      return
    }
    values.color = carColor(colorInput.value)
    dialog.close()
    if (editing) {
      const car = editing
      updateCars(boardId(), () => Object.assign(car, values))
      focusCar(car.id)
    } else add(values)
  })

  addButton.addEventListener('click', () => openEditor())
  removeButton.addEventListener('click', () => {
    if (!editing || !enabled()) return
    const id = boardId()
    const car = editing
    const index = carsFor(get(), id).indexOf(car)
    if (index < 0) return
    dialog.close()
    updateCars(id, (cars) => cars.splice(index, 1))
    addButton.focus()
    notify('Car removed.', () => updateCars(id, (cars) => cars.splice(index, 0, car)))
  })

  copyButton.addEventListener('click', async () => {
    if (!editing || !enabled()) return
    const currentTitle = title.value.trim()
    if (!currentTitle || currentTitle.length > titleLimit) {
      error.textContent = 'Enter a title up to 25 characters.'
      return
    }
    const text = [currentTitle, notes.value.trim()].filter(Boolean).join('\n')
    copiedCar = { text, color: carColor(colorInput.value) }
    const request = revision
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
    } catch {
      // Paste car also accepts the in-app copy when clipboard access is unavailable.
    }
    if (request === revision && dialog.open) error.textContent = 'Car copied.'
  })

  pasteButton.addEventListener('click', async () => {
    if (!enabled() || dialog.open) return
    const request = ++revision
    let text
    try {
      text = await navigator.clipboard?.readText()
    } catch {
      // Manual paste is available if the browser blocks clipboard reads.
    }
    if (request !== revision || !enabled() || dialog.open) return
    const source = text?.trim() || copiedCar?.text
    if (source) addPasted(source)
    else openEditor(null, true)
  })

  panel.addEventListener('paste', (event) => {
    if (!enabled() || dialog.open || event.target.closest('input, textarea, [contenteditable]')) return
    const text = event.clipboardData?.getData('text/plain')?.trim()
    if (!text) return
    event.preventDefault()
    revision++
    addPasted(text)
  })

  function moveCar(car, position, geometry) {
    if (!fitsMatrix(position, otherMatrixPositions(layer, car.id), geometry.space)) {
      notify('Leave at least half of each car visible.')
      return false
    }
    updateCars(boardId(), () => { car.position = position })
    focusCar(car.id)
    return true
  }

  function nudge(event, car, item) {
    const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
    const delta = directions[event.key]
    if (!delta || !enabled()) return
    event.preventDefault()
    const geometry = measureMatrix(layer)
    if (!geometry) return
    const position = renderedPosition(item)
    const step = event.shiftKey ? 24 : 8
    moveCar(car, {
      x: clampPosition(position.x + delta[0] * step / Math.max(geometry.space.width, 1)),
      y: clampPosition(position.y + delta[1] * step / Math.max(geometry.space.height, 1)),
    }, geometry)
  }

  function startDrag(event, car, item) {
    if (!event.isPrimary || event.button !== 0 || dragging || !enabled()) return
    const box = item.getBoundingClientRect()
    dragging = {
      car, item, pointer: event.pointerId, x: event.clientX, y: event.clientY,
      offsetX: event.clientX - box.left, offsetY: event.clientY - box.top, before: renderedPosition(item),
    }
    window.addEventListener('pointermove', previewDrag)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', cancelDrag)
    item.addEventListener('lostpointercapture', cancelDrag)
  }

  function dragPosition(event, { bounds, space }) {
    return {
      x: clampPosition((event.clientX - bounds.left - dragging.offsetX - inset) / Math.max(space.width, 1)),
      y: clampPosition((event.clientY - bounds.top - dragging.offsetY - inset) / Math.max(space.height, 1)),
    }
  }

  function previewDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointer || !enabled()) return
    if (!dragging.moved) {
      if (Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) < 6) return
      dragging.moved = true
      dragging.item.setPointerCapture(event.pointerId)
      dragging.item.classList.add('whiteboard-car-moving')
    }
    const geometry = measureMatrix(layer)
    if (geometry) placeNote(dragging.item, dragPosition(event, geometry))
  }

  function cancelDrag(event) {
    if (!dragging || (event && event.pointerId !== dragging.pointer)) return
    const { item, pointer, before } = dragging
    dragging = null
    window.removeEventListener('pointermove', previewDrag)
    window.removeEventListener('pointerup', finishDrag)
    window.removeEventListener('pointercancel', cancelDrag)
    item.removeEventListener('lostpointercapture', cancelDrag)
    if (item.hasPointerCapture(pointer)) item.releasePointerCapture(pointer)
    item.classList.remove('whiteboard-car-moving')
    if (before) placeNote(item, before)
  }

  function finishDrag(event) {
    if (!dragging || event.pointerId !== dragging.pointer) return
    const { car, moved } = dragging
    const geometry = moved && enabled() ? measureMatrix(layer) : null
    const position = geometry ? dragPosition(event, geometry) : null
    cancelDrag()
    if (position) moveCar(car, position, geometry)
  }

  return {
    render,
    reset(clearCopy = false) {
      revision++
      cancelDrag()
      if (dialog.open) dialog.close()
      editing = null
      if (clearCopy) copiedCar = null
    },
  }
}

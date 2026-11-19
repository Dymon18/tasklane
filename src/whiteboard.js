import { drawTemplate, frameworks } from './templates.js'
import { createWhiteboardCars } from './whiteboard-cars.js'

const byId = (id) => document.getElementById(id)

export function createWhiteboard({ get, update, notify }) {
  const canvas = byId('canvas')
  const ctx = canvas.getContext('2d')
  const template = byId('framework')
  const gallery = byId('framework-gallery')
  const editor = byId('whiteboard-editor')
  const back = byId('framework-back')
  const zoom = byId('canvas-zoom')
  const layer = byId('template-canvas')
  const scroller = canvas.closest('.canvas-scroller')
  const textEditor = byId('text-editor')
  const textInput = byId('canvas-text')
  const ink = byId('ink')
  const size = byId('ink-size')
  const toolButtons = document.querySelectorAll('[data-tool]')
  const undo = byId('canvas-undo')
  const clear = byId('canvas-clear')
  const cars = createWhiteboardCars({ get, update, notify, boardId: () => template.value })
  let tool = 'pen'
  let active = null
  let pan = null
  let textPoint = null
  let frame = 0

  for (const [id, name] of Object.entries(frameworks)) template.add(new Option(name, id))
  for (const [id, name] of Object.entries(frameworks)) {
    const tile = document.createElement('button')
    tile.className = 'framework-tile'
    tile.type = 'button'
    const thumbnail = document.createElement('canvas')
    thumbnail.width = 360
    thumbnail.height = 210
    thumbnail.setAttribute('aria-hidden', 'true')
    drawTemplate(thumbnail, id)
    const label = document.createElement('span')
    label.textContent = name
    tile.append(thumbnail, label)
    tile.addEventListener('click', () => {
      select(id)
      back.focus()
    })
    gallery.append(tile)
  }

  function marksFor(state, id = template.value) {
    return id === 'blank' ? state.marks : state.frameworkMarks[id] ?? []
  }

  function setMarks(state, id, marks) {
    if (id === 'blank') state.marks = marks
    else if (marks.length) state.frameworkMarks[id] = marks
    else delete state.frameworkMarks[id]
  }

  function renderTemplate() {
    const id = template.value
    byId('panel-whiteboard').dataset.template = id
    cars.render()
    if (!id) return
    canvas.setAttribute('aria-label', `${frameworks[id]} drawing canvas`)
    drawTemplate(layer, id)
    draw()
  }
  function resetInteraction(clearCopy = false) {
    active = null
    pan = null
    textPoint = null
    if (textEditor.open) textEditor.close()
    cars.reset(clearCopy)
  }

  function showGallery() {
    resetInteraction()
    template.value = ''
    gallery.hidden = false
    editor.hidden = true
    back.hidden = true
    renderTemplate()
  }

  function select(id) {
    if (!Object.hasOwn(frameworks, id)) return
    resetInteraction()
    template.value = id
    gallery.hidden = true
    editor.hidden = false
    back.hidden = false
    renderTemplate()
  }

  template.addEventListener('change', () => {
    if (template.value) select(template.value)
    else showGallery()
  })
  back.addEventListener('click', () => {
    showGallery()
    gallery.querySelector('button').focus()
  })
  zoom.addEventListener('change', () => byId('canvas-stack').style.setProperty('--board-width', zoom.value + '%'))

  function point(event) {
    const rect = canvas.getBoundingClientRect()
    const within = (value, length) => Math.max(0, Math.min(length, Math.round(value)))
    return [within((event.clientX - rect.left) * canvas.width / rect.width, canvas.width),
      within((event.clientY - rect.top) * canvas.height / rect.height, canvas.height)]
  }

  function paint(mark) {
    ctx.globalCompositeOperation = mark.kind === 'erase' ? 'destination-out' : 'source-over'
    ctx.fillStyle = ctx.strokeStyle = mark.color
    if (mark.kind === 'text') {
      ctx.font = `${Math.max(14, mark.size * 3)}px system-ui, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(mark.text, ...mark.point, Math.max(1, canvas.width - mark.point[0]))
      return
    }
    const [first, ...rest] = mark.points
    ctx.lineWidth = mark.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (!rest.length) {
      ctx.arc(...first, mark.size / 2, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    ctx.moveTo(...first)
    for (const next of rest) ctx.lineTo(...next)
    ctx.stroke()
  }

  function draw() {
    frame = 0
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const marks = marksFor(get())
    for (const mark of marks) paint(mark)
    if (active) paint(active.mark)
    undo.disabled = clear.disabled = marks.length === 0
  }

  function redraw() {
    if (!frame) frame = requestAnimationFrame(draw)
  }

  function add(mark) {
    const state = get()
    const marks = marksFor(state)
    const boards = [state.marks, ...Object.values(state.frameworkMarks)]
    const points = boards.reduce((sum, board) => sum +
      board.reduce((count, entry) => count + (entry.points?.length ?? 1), 0), 0)
    if (marks.length >= 1200 || points + (mark.points?.length ?? 1) > 50000) {
      notify('The whiteboard is full. Undo or clear some marks to keep drawing.')
      redraw()
      return
    }
    const id = template.value
    update((state) => setMarks(state, id, [...marks, mark]), false)
    redraw()
  }

  for (const button of toolButtons) button.addEventListener('click', () => {
    tool = button.dataset.tool
    canvas.dataset.tool = tool
    for (const control of toolButtons) control.setAttribute('aria-pressed', String(control === button))
    byId('canvas-hint').textContent = tool === 'text' ? 'Click the board where you want to place text.'
      : tool === 'line' ? 'Drag between two points to draw a straight line.'
        : tool === 'erase' ? 'Drag over your marks to erase them.'
          : tool === 'pan' ? 'Drag to move around a zoomed-in board.' : 'Drag across the board to draw.'
  })

  function startText(position) {
    textPoint = { kind: 'text', point: position, color: ink.value, size: Number(size.value) }
    textInput.value = ''
    textEditor.showModal()
    textInput.focus()
  }
  canvas.addEventListener('keydown', (event) => {
    if (tool !== 'text' || event.key !== 'Enter') return
    event.preventDefault()
    startText([canvas.width / 2, canvas.height / 2])
  })

  canvas.addEventListener('pointerdown', (event) => {
    if (!ctx || active || !event.isPrimary || event.button !== 0) return
    if (tool === 'pan') {
      if (event.pointerType !== 'touch') {
        pan = { pointer: event.pointerId, x: event.clientX + scroller.scrollLeft, y: event.clientY + scroller.scrollTop }
        canvas.setPointerCapture(event.pointerId)
      }
      return
    }
    const start = point(event)
    if (tool === 'text') {
      startText(start)
      return
    }
    const style = { color: ink.value, size: Number(size.value) }
    active = { pointer: event.pointerId, mark: { kind: tool, points: [start], ...style } }
    canvas.setPointerCapture(event.pointerId)
    redraw()
  })
  function extend(event) {
    const mark = active.mark
    const next = point(event)
    if (mark.kind === 'line') mark.points[1] = next
    else {
      const [x, y] = mark.points.at(-1)
      if (Math.hypot(next[0] - x, next[1] - y) >= 2 && mark.points.length < 1600) mark.points.push(next)
    }
  }
  canvas.addEventListener('pointermove', (event) => {
    if (pan && pan.pointer === event.pointerId) {
      scroller.scrollLeft = pan.x - event.clientX
      scroller.scrollTop = pan.y - event.clientY
      return
    }
    if (event.pointerId !== active?.pointer) return
    extend(event)
    redraw()
  })
  canvas.addEventListener('pointerup', (event) => {
    if (pan?.pointer === event.pointerId) pan = null
    if (event.pointerId !== active?.pointer) return
    extend(event)
    const { mark } = active
    active = null
    add(mark)
  })
  for (const type of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(type, (event) => {
    if (pan?.pointer === event.pointerId) pan = null
    if (event.pointerId !== active?.pointer) return
    active = null
    redraw()
  })
  byId('text-form').addEventListener('submit', (event) => {
    event.preventDefault()
    if (!textPoint || !textInput.value.trim()) return
    add({ ...textPoint, text: textInput.value.trim() })
    textEditor.close()
    textPoint = null
  })
  undo.addEventListener('click', () => {
    const id = template.value
    update((state) => setMarks(state, id, marksFor(state, id).slice(0, -1)), false)
    redraw()
  })
  clear.addEventListener('click', () => {
    const id = template.value
    const previous = marksFor(get(), id)
    update((state) => setMarks(state, id, []), false)
    notify('Whiteboard cleared.', () => {
      update((state) => setMarks(state, id, [...previous, ...marksFor(state, id)]), false)
      redraw()
    })
    redraw()
  })

  return {
    select,
    showGallery,
    reset() {
      resetInteraction(true)
      renderTemplate()
    },
  }
}

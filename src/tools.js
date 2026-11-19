const byId = (id) => document.getElementById(id)
const defaultOptions = 'Take a walk\nRead a chapter\nStart the next task'
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const wheelColors = ['#f6c9ba', '#b8d7e0', '#f5dc9d', '#cfdfba', '#dacbec', '#efd1a8']

export function createTools({ get, update, notify }) {
  const canvas = byId('canvas')
  const ctx = canvas.getContext('2d')
  const textEditor = byId('text-editor')
  const textInput = byId('canvas-text')
  const ink = byId('ink')
  const size = byId('ink-size')
  const toolButtons = document.querySelectorAll('[data-tool]')
  const undo = byId('canvas-undo')
  const clear = byId('canvas-clear')
  let tool = 'pen'
  let active = null
  let textPoint = null
  let frame = 0

  function point(event) {
    const rect = canvas.getBoundingClientRect()
    const within = (value, length) => Math.max(0, Math.min(length, Math.round(value)))
    return [within((event.clientX - rect.left) * canvas.width / rect.width, canvas.width),
      within((event.clientY - rect.top) * canvas.height / rect.height, canvas.height)]
  }

  function paint(mark) {
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
    for (const mark of get().marks) paint(mark)
    if (active) paint(active.mark)
    undo.disabled = clear.disabled = get().marks.length === 0
  }

  function redraw() {
    if (!frame) frame = requestAnimationFrame(draw)
  }

  function add(mark) {
    const points = get().marks.reduce((count, entry) => count + (entry.points?.length ?? 1), 0)
    if (get().marks.length >= 1200 || points + (mark.points?.length ?? 1) > 24000) {
      notify('The whiteboard is full. Undo or clear some marks to keep drawing.')
      redraw()
      return
    }
    update(({ marks }) => marks.push(mark), false)
    redraw()
  }

  for (const button of toolButtons) button.addEventListener('click', () => {
    tool = button.dataset.tool
    for (const control of toolButtons) control.setAttribute('aria-pressed', String(control === button))
    byId('canvas-hint').textContent = tool === 'text' ? 'Click the board where you want to place text.'
      : tool === 'line' ? 'Drag between two points to draw a straight line.' : 'Drag across the board to draw.'
  })
  canvas.addEventListener('pointerdown', (event) => {
    if (!ctx || active || !event.isPrimary || event.button !== 0) return
    const start = point(event)
    const style = { color: ink.value, size: Number(size.value) }
    if (tool === 'text') {
      textPoint = { kind: 'text', point: start, ...style }
      textInput.value = ''
      textEditor.showModal()
      textInput.focus()
      return
    }
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
    if (event.pointerId !== active?.pointer) return
    extend(event)
    redraw()
  })
  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerId !== active?.pointer) return
    extend(event)
    const { mark } = active
    active = null
    add(mark)
  })
  for (const type of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(type, (event) => {
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
    update(({ marks }) => marks.pop(), false)
    redraw()
  })
  clear.addEventListener('click', () => {
    const previous = get().marks
    update((state) => { state.marks = [] }, false)
    notify('Whiteboard cleared.', () => {
      update((state) => { state.marks = [...previous, ...state.marks] }, false)
      redraw()
    })
    redraw()
  })

  const choices = byId('wheel-options')
  const wheel = byId('wheel')
  const spin = byId('wheel-spin')
  const wheelResult = byId('wheel-result')
  const coin = byId('coin')
  const flip = byId('coin-flip')
  const coinResult = byId('coin-result')
  let wheelTimer
  let coinTimer
  let rotation = 0

  const options = () => choices.value.split('\n').map((label) => label.trim()).filter(Boolean)
  const valid = (list) => list.length >= 2 && list.length <= 12
  function paintWheel(list) {
    const count = valid(list) ? list.length : 4
    const angle = 360 / count
    const segments = Array.from({ length: count }, (_, index) =>
      `${wheelColors[index % wheelColors.length]} ${index * angle}deg ${(index + 1) * angle}deg`)
    wheel.style.background = 'conic-gradient(' + segments.join(', ') + ')'
    wheel.replaceChildren()
    if (!valid(list)) return
    list.forEach((label, index) => {
      const text = document.createElement('span')
      const radians = (index + .5) * angle * Math.PI / 180
      text.style.left = 50 + Math.sin(radians) * 32 + '%'
      text.style.top = 50 - Math.cos(radians) * 32 + '%'
      text.textContent = label
      wheel.append(text)
    })
  }
  choices.addEventListener('input', () => {
    paintWheel(options())
    wheelResult.textContent = 'Add 2–12 options, one per line.'
    update((state) => { state.wheel = choices.value }, false)
  })
  spin.addEventListener('click', () => {
    const list = options()
    if (!valid(list)) {
      wheelResult.textContent = 'Enter between 2 and 12 options before spinning.'
      choices.focus()
      return
    }
    const index = Math.floor(Math.random() * list.length)
    const center = (index + .5) * 360 / list.length
    const delta = (360 - center - (rotation % 360) + 360) % 360
    rotation += 360 * 4 + delta
    wheel.style.transform = `rotate(${rotation}deg)`
    choices.disabled = spin.disabled = true
    wheelResult.textContent = 'Spinning…'
    wheelTimer = setTimeout(() => {
      wheelResult.textContent = list[index]
      choices.disabled = spin.disabled = false
    }, reducedMotion() ? 0 : 1500)
  })
  flip.addEventListener('click', () => {
    const heads = Math.random() < .5
    flip.disabled = true
    coin.classList.add('is-flipping')
    coinResult.textContent = 'Flipping…'
    coinTimer = setTimeout(() => {
      coin.classList.remove('is-flipping')
      coin.textContent = heads ? 'H' : 'T'
      coinResult.textContent = heads ? 'Heads' : 'Tails'
      flip.disabled = false
    }, reducedMotion() ? 0 : 700)
  })

  return {
    reset() {
      active = null
      textPoint = null
      if (textEditor.open) textEditor.close()
      draw()
      clearTimeout(wheelTimer)
      clearTimeout(coinTimer)
      choices.disabled = spin.disabled = flip.disabled = false
      choices.value = get().wheel
      rotation = 0
      wheel.style.transform = ''
      paintWheel(options())
      wheelResult.textContent = 'Add 2–12 options, one per line.'
      coin.classList.remove('is-flipping')
      coin.textContent = 'H'
      coinResult.textContent = 'Heads or tails?'
    },
  }
}

export { defaultOptions }

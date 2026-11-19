const byId = (id) => document.getElementById(id)
const create = (tag, value, className) => {
  const element = document.createElement(tag)
  if (value) element.textContent = value
  if (className) element.className = className
  return element
}
const button = (label, className, onClick, accessibleName = label) => {
  const element = create('button', label, className)
  element.type = 'button'
  element.setAttribute('aria-label', accessibleName)
  element.addEventListener('click', onClick)
  return element
}

export const lanes = {
  today: { name: 'To-do Lane', hint: 'Day-to-day tasks', color: '#ecf0f8', car: '#d5e3f6', symbol: '≡' },
  highway: { name: 'Goal Highway', hint: 'Long-term goals', color: '#f0eaf7', car: '#e8d8f4', symbol: '⇅' },
  parking: { name: 'Parking Lot', hint: 'Ideas to revisit', color: '#edf1e4', car: '#e1ebcd', symbol: 'P' },
  shopping: { name: 'Shopping Cart', hint: 'Things to pick up', color: '#f8efdb', car: '#f8e4ae', symbol: '🛒' },
  express: { name: 'Express Lane', heading: 'Urgent + important', hint: 'Do now', color: '#fbede7', car: '#f7cfc0' },
  schedule: { name: 'Scenic Route', heading: 'Not urgent + important', hint: 'Schedule', color: '#e7f2f3', car: '#c5e5e7' },
  delegate: { name: 'Carpool Lane', heading: 'Urgent + not important', hint: 'Delegate', color: '#f7eedc', car: '#f7dfab' },
  skip: { name: 'Off-Ramp', heading: 'Not urgent + not important', hint: 'Let go', color: '#edf1e5', car: '#dfebcd' },
  strengths: { name: 'Strengths', hint: 'What’s working?', color: '#bfdae0', car: '#79a6b6', swot: true },
  weaknesses: { name: 'Weaknesses', hint: 'Where can you improve?', color: '#f9d4ad', car: '#cd9a65', swot: true },
  opportunities: { name: 'Opportunities', hint: 'What could help you grow?', color: '#d6e5c7', car: '#91a775', swot: true },
  threats: { name: 'Threats', hint: 'What could get in your way?', color: '#f6cbc2', car: '#c98277', swot: true },
}
const roadmap = ['parking', 'highway', 'today', 'shopping']
const matrix = ['express', 'schedule', 'delegate', 'skip']
const swot = ['strengths', 'weaknesses', 'opportunities', 'threats']
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateText = (day) => day ? dateFormat.format(new Date(day + 'T12:00:00')) : ''
const inset = 4
const clampPosition = (value) => Math.max(0, Math.min(1, value))

function placeNote(note, { x, y }) {
  note.style.setProperty('--note-x', x)
  note.style.setProperty('--note-y', y)
}

function layOutNotes(area) {
  const notes = [...area.querySelectorAll('.task-card')]
  if (!notes.length) return
  const bounds = area.getBoundingClientRect()
  const size = notes[0].offsetWidth
  if (!size || !bounds.width || !bounds.height) return
  const width = Math.max(0, bounds.width - inset * 2 - size)
  const height = Math.max(0, bounds.height - inset * 2 - size)
  const columns = Math.floor(width / (size + 8)) + 1
  const rows = Math.floor(height / (size + 8)) + 1
  const slots = Array.from({ length: rows * columns }, (_, index) => ({
    x: columns > 1 ? (index % columns) / (columns - 1) : 0,
    y: rows > 1 ? Math.floor(index / columns) / (rows - 1) : 0,
  }))
  const occupied = notes.filter((note) => note.dataset.positioned).map((note) => ({
    x: Number(note.style.getPropertyValue('--note-x')),
    y: Number(note.style.getPropertyValue('--note-y')),
  }))
  let stacked = 0
  for (const note of notes) {
    if (note.dataset.positioned) continue
    let place = slots.find((slot) => !occupied.some((other) =>
      Math.abs(slot.x - other.x) * width < size + 3 && Math.abs(slot.y - other.y) * height < size + 3))
    if (!place) {
      const slot = slots[stacked % slots.length]
      const offset = (1 + Math.floor(stacked / slots.length) % 8) * .04
      place = { x: clampPosition(slot.x + (slot.x > .5 ? -offset : offset)),
        y: clampPosition(slot.y + (slot.y > .5 ? -offset : offset)) }
      stacked++
    }
    placeNote(note, place)
    occupied.push(place)
  }
}

export function createBoard({ get, update, notify }) {
  const editor = byId('task-editor')
  const form = byId('task-form')
  const title = byId('task-title')
  const notes = byId('task-notes')
  const laneInput = byId('task-lane')
  const due = byId('task-due')
  const overview = byId('overview')
  const table = byId('task-table')
  const groups = [[byId('roadmap'), roadmap], [byId('matrix'), matrix],
    [byId('matrix-lanes'), roadmap], [byId('swot'), swot]]
  let editing
  let drag = null
  const sizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((entries) => entries.forEach(({ target }) => layOutNotes(target))) : null

  function focusCard(id, selector) {
    const matches = document.querySelectorAll(`[data-card-id="${CSS.escape(id)}"] ${selector}`)
    const visible = [...matches].find((element) => !element.closest('[hidden]'))
    visible?.focus({ preventScroll: true })
  }

  function edit(card, lane = 'today') {
    editing = card ?? null
    form.reset()
    title.value = card?.title ?? ''
    notes.value = card?.notes ?? ''
    due.value = card?.due ?? ''
    const isSwot = lanes[card?.lane ?? lane].swot
    laneInput.replaceChildren(...Object.entries(lanes).filter(([, option]) => Boolean(option.swot) === Boolean(isSwot))
      .map(([key, option]) => new Option(option.name, key)))
    laneInput.value = card?.lane ?? lane
    byId('task-error').textContent = ''
    byId('task-delete').hidden = !card
    updateEditor()
    editor.showModal()
    title.focus()
  }

  function updateEditor() {
    const isNote = lanes[laneInput.value].swot
    byId('task-heading').textContent = (editing ? 'Edit ' : 'Add ') + (isNote ? 'note' : 'task')
    due.closest('label').hidden = Boolean(isNote)
  }

  function remove(card) {
    const position = get().cards.findIndex(({ id }) => id === card.id)
    if (position < 0) return
    update(({ cards }) => cards.splice(position, 1))
    notify('Removed ' + card.title + '.', () => update(({ cards }) => cards.splice(position, 0, card)))
  }

  function actions(card) {
    const group = create('div', '', 'task-actions')
    if (!lanes[card.lane].swot) {
      const toggle = button(card.done ? '↶' : '✓', 'task-action', () => {
        update(() => { card.done = !card.done })
        focusCard(card.id, '.task-action:not(.remove)')
      }, card.done ? 'Reopen ' + card.title : 'Complete ' + card.title)
      group.append(toggle)
    }
    group.append(button('×', 'task-action remove', () => remove(card), 'Remove ' + card.title))
    return group
  }

  function makeCard(card) {
    const item = create('article', '', 'task-card' + (card.done ? ' done' : ''))
    item.dataset.cardId = card.id
    item.style.setProperty('--car', lanes[card.lane].car)
    if (card.position) {
      item.dataset.positioned = 'true'
      placeNote(item, card.position)
    }
    const token = create('span', '', 'car-token')
    token.setAttribute('aria-hidden', 'true')
    const content = button('', 'task-content', () => edit(card), 'Edit ' + card.title)
    content.append(create('strong', card.title, 'task-title'))
    if (card.due) content.append(create('span', dateText(card.due), 'task-detail'))
    item.append(token, content, actions(card))
    item.addEventListener('pointerdown', (event) => startDrag(event, card, item))
    return item
  }

  function renderTable() {
    const rows = []
    for (const card of get().cards) {
      if (lanes[card.lane].swot) continue
      const row = create('tr', '', card.done ? 'done' : '')
      row.dataset.cardId = card.id
      const task = create('th')
      task.scope = 'row'
      task.append(button(card.title, 'task-content', () => edit(card), 'Edit ' + card.title))
      if (card.notes) task.append(create('span', card.notes, 'task-detail'))
      const controls = create('td')
      controls.append(actions(card))
      row.append(task, create('td', lanes[card.lane].name), create('td', dateText(card.due) || '—'), controls)
      rows.push(row)
    }
    table.querySelector('tbody').replaceChildren(...rows)
    byId('table-empty').hidden = rows.length !== 0
  }

  function render() {
    cancelDrag()
    sizeObserver?.disconnect()
    const cards = get().cards
    const tasks = cards.filter((card) => !lanes[card.lane].swot)
    const metrics = [[tasks.filter((card) => !card.done).length, 'Open tasks'],
      [tasks.filter((card) => card.lane === 'highway' && !card.done).length, 'Active goals'],
      [tasks.filter((card) => card.done).length, 'Completed']]
    overview.replaceChildren(...metrics.map(([count, label]) => {
      const metric = create('div', '', 'metric')
      metric.append(create('strong', String(count)), create('span', label))
      return metric
    }))
    for (const [group, keys] of groups) {
      const scroll = new Map([...group.querySelectorAll('.lane')].map((lane) =>
        [lane.dataset.lane, lane.querySelector('.cards').scrollTop]))
      const columns = keys.map((key) => {
        const lane = lanes[key]
        const section = create('section', '', 'lane')
        section.dataset.lane = key
        section.style.setProperty('--lane', lane.color)
        const heading = create('header', '', 'lane-heading')
        const name = create('div')
        const headingId = group.id + '-' + key
        const label = create('h2', lane.heading ?? lane.name)
        label.id = headingId
        section.setAttribute('aria-labelledby', headingId)
        if (lane.symbol) {
          const symbol = create('span', lane.symbol, 'lane-symbol')
          symbol.setAttribute('aria-hidden', 'true')
          label.prepend(symbol)
        }
        name.append(label)
        if (lane.heading) {
          const hint = document.createElement('p')
          hint.append(create('em', lane.name), ' · ' + lane.hint)
          name.append(hint)
        } else name.append(create('p', lane.hint))
        heading.append(name, button('+', '', () => edit(null, key), 'Add to ' + lane.name))
        const items = create('div', '', group.id === 'matrix' ? 'cards free-notes' : 'cards')
        items.append(...cards.filter((card) => card.lane === key).map(makeCard))
        if (!items.childElementCount) items.append(create('p', lane.swot ? 'No notes yet' : 'No tasks yet', 'empty'))
        section.append(heading, items)
        return section
      })
      group.replaceChildren(...columns)
      for (const column of columns) column.querySelector('.cards').scrollTop = scroll.get(column.dataset.lane) ?? 0
    }
    for (const area of byId('matrix').querySelectorAll('.free-notes')) {
      layOutNotes(area)
      sizeObserver?.observe(area)
    }
    byId('saved-swot').hidden = !cards.some(({ lane }) => lanes[lane].swot)
    renderTable()
  }

  // Use a single pointer interaction for mice, pens and touch drag handles.
  function startDrag(event, card, item) {
    if (!event.isPrimary || event.button !== 0 || drag || event.target.closest('.task-action')) return
    if (event.pointerType === 'touch' && !event.target.closest('.car-token')) return
    drag = { card, item, pointer: event.pointerId, x: event.clientX, y: event.clientY }
    window.addEventListener('pointermove', moveDrag)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', cancelDrag)
    item.addEventListener('lostpointercapture', cancelDrag)
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return
    const { item, x, y } = drag
    const dx = event.clientX - x
    const dy = event.clientY - y
    if (!drag.ghost) {
      if (Math.hypot(dx, dy) < 6) return
      item.setPointerCapture(event.pointerId)
      const rect = item.getBoundingClientRect()
      drag.sourceBounds = rect
      const ghost = item.cloneNode(true)
      ghost.classList.add('drag-ghost')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.inert = true
      Object.assign(ghost.style, { left: rect.left + 'px', top: rect.top + 'px',
        width: rect.width + 'px', minHeight: rect.height + 'px' })
      ghost.style.setProperty('--scale', getComputedStyle(item).getPropertyValue('--scale'))
      document.body.append(ghost)
      item.classList.add('is-dragging')
      drag.ghost = ghost
    }
    drag.ghost.style.transform = `translate(${dx}px,${dy}px) rotate(2deg)`
    drag.target?.removeAttribute('data-over')
    drag.before?.classList.remove('insert-before')
    drag.target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-lane]')
    if (drag.target && Boolean(lanes[drag.target.dataset.lane].swot) !== Boolean(lanes[drag.card.lane].swot)) drag.target = null
    drag.before = drag.target?.querySelector('.free-notes') ? null
      : [...(drag.target?.querySelectorAll('.task-card:not(.is-dragging)') ?? [])].find((candidate) => {
      const rect = candidate.getBoundingClientRect()
      return event.clientY < rect.top || (event.clientY <= rect.bottom && event.clientX < rect.left + rect.width / 2)
    })
    drag.target?.setAttribute('data-over', 'true')
    drag.before?.classList.add('insert-before')
  }

  function cancelDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointer)) return
    const { item, pointer, target, before, ghost } = drag
    drag = null
    window.removeEventListener('pointermove', moveDrag)
    window.removeEventListener('pointerup', finishDrag)
    window.removeEventListener('pointercancel', cancelDrag)
    item.removeEventListener('lostpointercapture', cancelDrag)
    if (item.hasPointerCapture(pointer)) item.releasePointerCapture(pointer)
    item.classList.remove('is-dragging')
    target?.removeAttribute('data-over')
    before?.classList.remove('insert-before')
    ghost?.remove()
  }

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return
    const { card, target, before, ghost, sourceBounds, x, y } = drag
    const destination = target?.dataset.lane
    const origin = ghost?.getBoundingClientRect()
    const anchor = before?.dataset.cardId
    const area = target?.querySelector('.free-notes')
    let position
    if (area && sourceBounds && origin) {
      const bounds = area.getBoundingClientRect()
      const sample = area.querySelector('.task-card')
      let noteSize = sample?.offsetWidth
      if (!noteSize) {
        const measure = makeCard(card)
        measure.style.visibility = 'hidden'
        area.append(measure)
        noteSize = measure.offsetWidth || sourceBounds.width
        measure.remove()
      }
      const fractionX = (x - sourceBounds.left) / Math.max(1, sourceBounds.width)
      const fractionY = (y - sourceBounds.top) / Math.max(1, sourceBounds.height)
      position = {
        x: clampPosition((event.clientX - bounds.left - inset - fractionX * noteSize)
          / Math.max(1, bounds.width - noteSize - inset * 2)),
        y: clampPosition((event.clientY - bounds.top - inset - fractionY * noteSize)
          / Math.max(1, bounds.height - noteSize - inset * 2)),
      }
    }
    cancelDrag()
    if (!destination || !origin) return
    update(({ cards }) => {
      cards.splice(cards.indexOf(card), 1)
      card.lane = destination
      if (position) card.position = position
      else delete card.position
      const next = anchor ? cards.findIndex(({ id }) => id === anchor) : cards.length
      cards.splice(next < 0 ? cards.length : next, 0, card)
    })
    const landed = [...document.querySelectorAll('.task-card')].find((item) =>
      item.dataset.cardId === card.id && item.getClientRects().length)
    if (landed && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const rect = landed.getBoundingClientRect()
      landed.animate([{ transform: `translate(${origin.left - rect.left}px,${origin.top - rect.top}px) rotate(2deg)` },
        { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.7,.25,1)' })
    }
  }

  const newTask = byId('new-task')
  newTask.addEventListener('click', () => edit(null))
  for (const control of document.querySelectorAll('[data-add-lane]')) {
    control.addEventListener('click', () => edit(null, control.dataset.addLane))
  }
  laneInput.addEventListener('change', updateEditor)
  byId('task-delete').addEventListener('click', () => {
    editor.close()
    if (editing) remove(editing)
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const name = title.value.trim()
    if (!name) {
      byId('task-error').textContent = 'Enter a title.'
      return
    }
    const lane = laneInput.value
    const id = editing?.id ?? crypto.randomUUID()
    const item = { title: name, notes: notes.value.trim(), due: lanes[lane].swot ? '' : due.value,
      lane, done: !lanes[lane].swot && Boolean(editing?.done) }
    update(({ cards }) => {
      if (editing) {
        if (editing.lane !== lane) delete editing.position
        Object.assign(editing, item)
      }
      else cards.push({ id, ...item })
    })
    editor.close()
    focusCard(id, '.task-content')
  })
  const matrixLayout = byId('matrix-layout')
  const side = byId('matrix-side')
  const laneToggle = byId('lanes-toggle')
  laneToggle.addEventListener('click', () => {
    cancelDrag()
    side.hidden = !side.hidden
    matrixLayout.classList.toggle('side-hidden', side.hidden)
    laneToggle.setAttribute('aria-expanded', String(!side.hidden))
    laneToggle.textContent = side.hidden ? 'Show side lanes' : 'Hide side lanes'
  })
  const sizes = [65, 80, 100, 125, 150]
  const smaller = byId('smaller-cars')
  const larger = byId('larger-cars')
  let sizeIndex = 2
  function resize(step) {
    sizeIndex = Math.max(0, Math.min(sizes.length - 1, sizeIndex + step))
    const size = sizes[sizeIndex]
    matrixLayout.style.setProperty('--car-scale', size / 100)
    for (const area of byId('matrix').querySelectorAll('.free-notes')) layOutNotes(area)
    byId('car-size').textContent = size + '%'
    smaller.disabled = sizeIndex === 0
    larger.disabled = sizeIndex === sizes.length - 1
  }
  smaller.addEventListener('click', () => resize(-1))
  larger.addEventListener('click', () => resize(1))

  return {
    render,
    reset() {
      cancelDrag()
      if (editor.open) editor.close()
      editing = null
    },
  }
}

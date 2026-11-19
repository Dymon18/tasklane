import { clampPosition, findMatrixSpot, fitsMatrix, inset, randomPosition } from './matrix-placement.js'
import { createCarNote, layOutNotes, measureMatrix, otherMatrixPositions, renderedPosition, setPreferredPosition, titleLimit } from './car-notes.js'

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
  express: { name: 'Express Lane', color: '#fbede7', car: '#f7cfc0' },
  schedule: { name: 'Scenic Route', color: '#e7f2f3', car: '#c5e5e7' },
  delegate: { name: 'Carpool Lane', color: '#f7eedc', car: '#f7dfab' },
  skip: { name: 'Off Road', color: '#edf1e5', car: '#dfebcd' },
  strengths: { name: 'Strengths', hint: 'What’s working?', color: '#bfdae0', car: '#79a6b6', swot: true },
  weaknesses: { name: 'Weaknesses', hint: 'Where can you improve?', color: '#f9d4ad', car: '#cd9a65', swot: true },
  opportunities: { name: 'Opportunities', hint: 'What could help you grow?', color: '#d6e5c7', car: '#91a775', swot: true },
  threats: { name: 'Threats', hint: 'What could get in your way?', color: '#f6cbc2', car: '#c98277', swot: true },
}
export const shoppingCategories = {
  groceries: 'Groceries',
  short: 'Short Term',
  long: 'Long Term',
  others: 'Others',
}
export const shoppingCategory = (value) => Object.hasOwn(shoppingCategories, value) ? value : 'others'
const roadmap = ['parking', 'highway', 'today', 'shopping']
const matrix = ['express', 'schedule', 'delegate', 'skip']
const swot = ['strengths', 'weaknesses', 'opportunities', 'threats']
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateText = (day) => day ? dateFormat.format(new Date(day + 'T12:00:00')) : ''
export function createBoard({ get, update, notify }) {
  const editor = byId('task-editor')
  const form = byId('task-form')
  const title = byId('task-title')
  const notes = byId('task-notes')
  const laneInput = byId('task-lane')
  const due = byId('task-due')
  const categoryField = byId('task-shopping-field')
  const categoryInput = byId('task-shopping-category')
  const overview = byId('overview')
  const table = byId('task-table')
  const matrixBoard = byId('matrix')
  const groups = [[byId('roadmap'), roadmap], [matrixBoard, matrix],
    [byId('matrix-lanes'), roadmap], [byId('swot'), swot]]
  let editing
  let drag = null
  const sizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((entries) => entries.forEach(({ target }) => layOutNotes(target))) : null
  for (const [id, name] of Object.entries(shoppingCategories)) categoryInput.add(new Option(name, id))
  matrix.forEach((key, index) => {
    const lane = lanes[key]
    const label = create('div', '', 'matrix-lane-label')
    const name = create('h2', lane.name)
    name.id = 'matrix-' + key
    label.append(name, button('+', '', () => edit(null, key), 'Add to ' + lane.name))
    byId(index < 2 ? 'matrix-labels-top' : 'matrix-labels-bottom').append(label)
  })

  function focusCard(id, selector) {
    const matches = document.querySelectorAll(`[data-card-id="${CSS.escape(id)}"] ${selector}`)
    const visible = [...matches].find((element) => !element.closest('[hidden]'))
    visible?.focus({ preventScroll: true })
  }

  function edit(card, lane = 'today', category) {
    editing = card ?? null
    form.reset()
    title.value = card?.title ?? ''
    notes.value = card?.notes ?? ''
    due.value = card?.due ?? ''
    title.maxLength = Math.max(titleLimit, card?.title.length ?? 0)
    const isSwot = lanes[card?.lane ?? lane].swot
    laneInput.replaceChildren(...Object.entries(lanes).filter(([, option]) => Boolean(option.swot) === Boolean(isSwot))
      .map(([key, option]) => new Option(option.name, key)))
    laneInput.value = card?.lane ?? lane
    categoryInput.value = shoppingCategory(card?.shoppingCategory ?? category)
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
    categoryField.hidden = laneInput.value !== 'shopping'
    categoryInput.disabled = categoryField.hidden
  }

  function remove(card) {
    const position = get().cards.findIndex(({ id }) => id === card.id)
    if (position < 0) return
    update(({ cards }) => {
      keepMatrixPositions(cards)
      cards.splice(position, 1)
    })
    notify('Removed ' + card.title + '.', () => update(({ cards }) => cards.splice(position, 0, card)))
  }

  function keepMatrixPositions(cards) {
    const byCard = new Map(cards.map((card) => [card.id, card]))
    for (const note of matrixBoard.querySelectorAll('.task-card')) {
      const position = renderedPosition(note)
      const card = byCard.get(note.dataset.cardId)
      if (card && position) card.position = position
    }
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
    const { item, content } = createCarNote(card, () => edit(card))
    if (card.done) item.classList.add('done')
    item.style.setProperty('--car', lanes[card.lane].car)
    if (card.position) setPreferredPosition(item, card.position)
    if (card.due) content.append(create('span', dateText(card.due), 'task-detail'))
    item.append(actions(card))
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
      const location = card.lane === 'shopping'
        ? `Shopping Cart · ${shoppingCategories[shoppingCategory(card.shoppingCategory)]}`
        : lanes[card.lane].name
      row.append(task, create('td', location), create('td', dateText(card.due) || '—'), controls)
      rows.push(row)
    }
    table.querySelector('tbody').replaceChildren(...rows)
    byId('table-empty').hidden = rows.length !== 0
  }

  function shoppingColumns(cards, prefix) {
    const columns = create('div', '', 'shopping-columns')
    for (const [id, name] of Object.entries(shoppingCategories)) {
      const section = create('section', '', 'shopping-category')
      section.dataset.lane = 'shopping'
      section.dataset.shoppingCategory = id
      const heading = create('header', '', 'lane-heading')
      const label = create('h3', name)
      label.id = prefix + '-' + id
      section.setAttribute('aria-labelledby', label.id)
      heading.append(label, button('+', '', () => edit(null, 'shopping', id), 'Add to ' + name))
      const items = create('div', '', 'cards')
      items.append(...cards.filter((card) => shoppingCategory(card.shoppingCategory) === id).map(makeCard))
      if (!items.childElementCount) items.append(create('p', 'No items yet', 'empty'))
      section.append(heading, items)
      columns.append(section)
    }
    return columns
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
      const listKey = (list) => {
        const target = list.closest('[data-lane]')
        return target.dataset.shoppingCategory ?? target.dataset.lane
      }
      const scroll = new Map([...group.querySelectorAll('.cards')].map((list) => [listKey(list), list.scrollTop]))
      const columns = keys.map((key) => {
        const lane = lanes[key]
        const section = create('section', '', 'lane')
        section.dataset.lane = key
        section.style.setProperty('--lane', lane.color)
        const headingId = group.id + '-' + key
        section.setAttribute('aria-labelledby', headingId)
        const laneCards = cards.filter((card) => card.lane === key)
        if (group === matrixBoard) {
          const items = create('div', '', 'cards free-notes')
          items.append(...laneCards.map(makeCard))
          section.append(items)
          return section
        }
        const heading = create('header', '', 'lane-heading')
        const name = create('div')
        const label = create('h2', lane.name)
        label.id = headingId
        if (lane.symbol) {
          const symbol = create('span', lane.symbol, 'lane-symbol')
          symbol.setAttribute('aria-hidden', 'true')
          label.prepend(symbol)
        }
        name.append(label, create('p', lane.hint))
        heading.append(name, button('+', '', () => edit(null, key), 'Add to ' + lane.name))
        if (key === 'shopping') {
          section.classList.add('shopping-lane')
          section.append(heading, shoppingColumns(laneCards, headingId))
          return section
        }
        const items = create('div', '', 'cards')
        items.append(...laneCards.map(makeCard))
        if (!items.childElementCount) items.append(create('p', lane.swot ? 'No notes yet' : 'No tasks yet', 'empty'))
        section.append(heading, items)
        return section
      })
      group.replaceChildren(...columns)
      for (const list of group.querySelectorAll('.cards')) list.scrollTop = scroll.get(listKey(list)) ?? 0
    }
    for (const area of matrixBoard.querySelectorAll('.free-notes')) {
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
    const isCartHeader = drag.target?.classList.contains('shopping-lane')
    drag.before = isCartHeader || drag.target?.querySelector('.free-notes') ? null
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
    let overlap = false
    if (area && sourceBounds && origin) {
      const geometry = measureMatrix(area)
      if (geometry) {
        const { bounds, space } = geometry
        const fractionX = (x - sourceBounds.left) / Math.max(1, sourceBounds.width)
        const fractionY = (y - sourceBounds.top) / Math.max(1, sourceBounds.height)
        position = {
          x: clampPosition((event.clientX - bounds.left - inset - fractionX * space.size) / Math.max(1, space.width)),
          y: clampPosition((event.clientY - bounds.top - inset - fractionY * space.size) / Math.max(1, space.height)),
        }
        overlap = !fitsMatrix(position, otherMatrixPositions(area, card.id), space)
      }
    }
    cancelDrag()
    if (!destination || !origin) return
    if (overlap) {
      notify('Leave at least half of each car visible.')
      return
    }
    update(({ cards }) => {
      keepMatrixPositions(cards)
      cards.splice(cards.indexOf(card), 1)
      card.lane = destination
      if (destination === 'shopping') {
        card.shoppingCategory = shoppingCategory(target.dataset.shoppingCategory ?? card.shoppingCategory)
      } else delete card.shoppingCategory
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
  title.addEventListener('input', () => { byId('task-error').textContent = '' })
  byId('task-delete').addEventListener('click', () => {
    editor.close()
    if (editing) remove(editing)
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const name = title.value.trim()
    const tooLong = name.length > titleLimit && name !== editing?.title
    if (!name || tooLong) {
      byId('task-error').textContent = tooLong ? 'Use 25 characters or fewer.' : 'Enter a title.'
      title.focus()
      return
    }
    const lane = laneInput.value
    const id = editing?.id ?? crypto.randomUUID()
    const item = { title: name, notes: notes.value.trim(), due: lanes[lane].swot ? '' : due.value,
      lane, done: !lanes[lane].swot && Boolean(editing?.done),
      ...(lane === 'shopping' ? { shoppingCategory: shoppingCategory(categoryInput.value) } : {}) }
    if (matrix.includes(lane) && lane !== editing?.lane) {
      const area = matrixBoard.querySelector(`[data-lane="${lane}"] .free-notes`)
      const geometry = measureMatrix(area)
      item.position = (geometry && findMatrixSpot(otherMatrixPositions(area, id), geometry.space, true)) ?? randomPosition()
    }
    update(({ cards }) => {
      keepMatrixPositions(cards)
      if (editing) {
        if (editing.lane !== lane) delete editing.position
        if (lane !== 'shopping') delete editing.shoppingCategory
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
  const sizes = [50, 65, 80]
  const smaller = byId('smaller-cars')
  const larger = byId('larger-cars')
  let sizeIndex = 2
  function resize(step) {
    sizeIndex = Math.max(0, Math.min(sizes.length - 1, sizeIndex + step))
    const size = sizes[sizeIndex]
    matrixLayout.style.setProperty('--car-scale', size / 100)
    for (const area of matrixBoard.querySelectorAll('.free-notes')) layOutNotes(area)
    byId('car-size').textContent = size + '%'
    smaller.disabled = sizeIndex === 0
    larger.disabled = sizeIndex === sizes.length - 1
  }
  smaller.addEventListener('click', () => resize(-1))
  larger.addEventListener('click', () => resize(1))
  resize(0)

  return {
    render,
    reset() {
      cancelDrag()
      if (editor.open) editor.close()
      editing = null
    },
  }
}

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
  today: { name: 'To-do Lane', hint: 'Tasks on your list', color: '#d9e9f4', car: '#6c9bc0' },
  highway: { name: 'Goal Highway', hint: 'Long-term goals and milestones', color: '#e7dff1', car: '#a78ab8' },
  parking: { name: 'Parking Lot', hint: 'Ideas to come back to', color: '#e2ebcf', car: '#91aa68' },
  shopping: { name: 'Shopping List', hint: 'Things to pick up', color: '#f8e9b9', car: '#c6a454' },
  express: { name: 'Express Lane', hint: 'Urgent and important · Do now', color: '#f6d3c8', car: '#d38176' },
  schedule: { name: 'Scenic Route', hint: 'Important, not urgent · Schedule', color: '#d4e8ea', car: '#77a8b8' },
  delegate: { name: 'Carpool Lane', hint: 'Urgent, not important · Delegate', color: '#f9e1c5', car: '#c99365' },
  skip: { name: 'Off-Ramp', hint: 'Neither urgent nor important · Drop', color: '#dce9d0', car: '#87a56f' },
  strengths: { name: 'Strengths', hint: 'What’s working?', color: '#bfdae0', car: '#79a6b6', swot: true },
  weaknesses: { name: 'Weaknesses', hint: 'Where can you improve?', color: '#f9d4ad', car: '#cd9a65', swot: true },
  opportunities: { name: 'Opportunities', hint: 'What could help you grow?', color: '#d6e5c7', car: '#91a775', swot: true },
  threats: { name: 'Threats', hint: 'What could get in your way?', color: '#f6cbc2', car: '#c98277', swot: true },
}
const roadmap = ['today', 'highway', 'parking', 'shopping']
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
  const overview = byId('overview')
  const table = byId('task-table')
  const tableToggle = byId('table-toggle')
  const groups = [[byId('roadmap'), roadmap], [byId('matrix'), matrix],
    [byId('matrix-parking'), ['parking']], [byId('swot'), swot]]
  let editing
  let tableView = false
  let drag = null

  for (const [key, lane] of Object.entries(lanes)) laneInput.add(new Option(lane.name, key))

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
    const token = create('span', '', 'car-token')
    token.style.setProperty('--car', lanes[card.lane].car)
    token.setAttribute('aria-hidden', 'true')
    const content = button('', 'task-content', () => edit(card), 'Edit ' + card.title)
    content.append(create('strong', card.title, 'task-title'))
    if (card.due) content.append(create('span', dateText(card.due), 'task-detail'))
    if (card.notes) content.append(create('span', card.notes, 'task-detail task-notes'))
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
      const columns = keys.map((key) => {
        const lane = lanes[key]
        const section = create('section', '', 'lane')
        section.dataset.lane = key
        section.style.setProperty('--lane', lane.color)
        const heading = create('header', '', 'lane-heading')
        const name = create('div')
        const headingId = group.id + '-' + key
        const label = create('h2', lane.name)
        label.id = headingId
        section.setAttribute('aria-labelledby', headingId)
        name.append(label, create('p', lane.hint))
        heading.append(name, button('+', '', () => edit(null, key), 'Add to ' + lane.name))
        const items = create('div', '', 'cards')
        items.append(...cards.filter((card) => card.lane === key).map(makeCard))
        if (!items.childElementCount) items.append(create('p', lane.swot ? 'No notes yet' : 'No tasks yet', 'empty'))
        section.append(heading, items)
        return section
      })
      group.replaceChildren(...columns)
    }
    if (tableView) renderTable()
  }

  // Use a single pointer interaction for mice, pens and touch drag handles.
  function startDrag(event, card, item) {
    if (!event.isPrimary || event.button !== 0 || drag || event.target.closest('button')) return
    if (event.pointerType === 'touch' && !event.target.closest('.car-token')) return
    drag = { card, item, pointer: event.pointerId, x: event.clientX, y: event.clientY }
    item.setPointerCapture(event.pointerId)
    item.addEventListener('pointermove', moveDrag)
    item.addEventListener('pointerup', finishDrag)
    item.addEventListener('pointercancel', cancelDrag)
    item.addEventListener('lostpointercapture', cancelDrag)
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return
    const { item, x, y } = drag
    const dx = event.clientX - x
    const dy = event.clientY - y
    if (!drag.ghost) {
      if (Math.hypot(dx, dy) < 6) return
      const rect = item.getBoundingClientRect()
      const ghost = item.cloneNode(true)
      ghost.classList.add('drag-ghost')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.inert = true
      ghost.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px`
      document.body.append(ghost)
      item.classList.add('is-dragging')
      drag.ghost = ghost
    }
    drag.ghost.style.transform = `translate(${dx}px,${dy}px) rotate(2deg)`
    drag.target?.removeAttribute('data-over')
    drag.before?.classList.remove('insert-before')
    drag.target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-lane]')
    drag.before = [...(drag.target?.querySelectorAll('.task-card:not(.is-dragging)') ?? [])].find((candidate) => {
      const rect = candidate.getBoundingClientRect()
      return event.clientY < rect.top + rect.height / 2
    })
    drag.target?.setAttribute('data-over', 'true')
    drag.before?.classList.add('insert-before')
  }

  function cancelDrag() {
    if (!drag) return
    const { item, pointer, target, before, ghost } = drag
    drag = null
    item.removeEventListener('pointermove', moveDrag)
    item.removeEventListener('pointerup', finishDrag)
    item.removeEventListener('pointercancel', cancelDrag)
    item.removeEventListener('lostpointercapture', cancelDrag)
    if (item.hasPointerCapture(pointer)) item.releasePointerCapture(pointer)
    item.classList.remove('is-dragging')
    target?.removeAttribute('data-over')
    before?.classList.remove('insert-before')
    ghost?.remove()
  }

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return
    const { card, target, before, ghost } = drag
    const destination = target?.dataset.lane
    const origin = ghost?.getBoundingClientRect()
    const anchor = before?.dataset.cardId
    cancelDrag()
    if (!destination || !origin) return
    update(({ cards }) => {
      cards.splice(cards.indexOf(card), 1)
      card.lane = destination
      if (lanes[destination].swot) {
        card.due = ''
        card.done = false
      }
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
      if (editing) Object.assign(editing, item)
      else cards.push({ id, ...item })
    })
    editor.close()
    focusCard(id, '.task-content')
  })
  tableToggle.addEventListener('click', () => {
    tableView = !tableView
    tableToggle.setAttribute('aria-pressed', String(tableView))
    tableToggle.textContent = tableView ? 'Show lanes' : 'Show task table'
    table.hidden = !tableView
    groups[0][0].hidden = tableView
    byId('lane-hint').hidden = tableView
    if (tableView) renderTable()
  })

  return {
    render,
    reset() {
      cancelDrag()
      if (editor.open) editor.close()
      editing = null
    },
  }
}

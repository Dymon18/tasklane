export const frameworks = {
  blank: 'Blank whiteboard',
  kanban: 'Kanban',
  eisenhower: 'Eisenhower matrix',
  swot: 'SWOT',
  timeline: 'Timeline / milestones',
  gantt: 'Gantt chart',
  impact: 'Impact / effort',
  'pros-cons': 'Pros and Cons',
}

// Keep saved boards for retired templates when a workspace is loaded and saved again.
export const savedFrameworkIds = [...Object.keys(frameworks), 'northstar', 'rice', 'swimlane', 'timeblock', 'mindmap']

const lineColor = '#8caaa0'
const colors = ['#f4dbd3', '#d9ecf0', '#f4e7c6', '#dfead3', '#ebe0f1']

export function drawTemplate(canvas, id) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform?.(canvas.width / 1200, 0, 0, canvas.height / 700, 0, 0)
  ctx.clearRect(0, 0, 1200, 700)
  ctx.lineWidth = 2
  ctx.strokeStyle = lineColor

  function line(x, y, x2, y2) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  function text(label, x, y, align = 'center', size = 24) {
    ctx.fillStyle = '#37554b'
    ctx.font = `650 ${size}px system-ui, sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x, y)
  }
  function box(x, y, width, height, color, label) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, width, height)
    ctx.strokeRect(x, y, width, height)
    if (label) text(label, x + width / 2, y + 28)
  }
  function grid(columns, rows) {
    const left = 44, top = 54, right = 1156, bottom = 654
    const width = (right - left) / columns.length
    const height = (bottom - top) / rows.length
    box(left, top, right - left, bottom - top, '#ffffff7a')
    columns.forEach((label, i) => {
      const x = left + width * i
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect(x, top, width, 42)
      if (i > 0) line(x, top, x, bottom)
      text(label, x + width / 2, top + 21, 'center', 20)
    })
    line(left, top + 42, right, top + 42)
    rows.forEach((label, i) => {
      const y = top + 42 + (height - 42 / rows.length) * i
      if (i > 0) line(left, y, right, y)
      if (label) text(label, left - 14, y + (height - 42 / rows.length) / 2, 'right', 20)
    })
  }
  function quadrants(axisX, axisY, cells) {
    const x = 148, y = 90, width = 490, height = 262, gap = 14
    axisX.forEach((label, i) => text(label, x + width / 2 + i * (width + gap), 52))
    axisY.forEach((label, i) => {
      ctx.save()
      ctx.translate(100, y + height / 2 + i * (height + gap))
      ctx.rotate(-Math.PI / 2)
      text(label, 0, 0)
      ctx.restore()
    })
    cells.forEach((label, i) => box(x + (i % 2) * (width + gap), y + Math.floor(i / 2) * (height + gap),
      width, height, colors[i], label))
  }

  switch (id) {
    case 'swot':
      quadrants(['Helpful', 'Harmful'], ['Internal', 'External'], ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'])
      break
    case 'eisenhower':
      quadrants(['Urgent', 'Not urgent'], ['Important', 'Not important'], ['Do now', 'Schedule', 'Delegate', 'Drop'])
      break
    case 'impact':
      quadrants(['Low effort', 'High effort'], ['High impact', 'Low impact'], ['Quick wins', 'Big projects', 'Fill-ins', 'Avoid'])
      break
    case 'kanban':
      grid(['To do', 'In progress', 'Done'], [''])
      break
    case 'gantt':
      grid(['Task', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'], Array(8).fill(''))
      break
    case 'pros-cons':
      box(44, 54, 548, 600, colors[3], 'Pros')
      box(608, 54, 548, 600, colors[0], 'Cons')
      break
    case 'timeline': {
      line(85, 350, 1115, 350)
      const milestones = [150, 375, 600, 825, 1050]
      milestones.forEach((x, i) => {
        const y = i % 2 ? 395 : 150
        line(x, 350, x, i % 2 ? y : y + 155)
        ctx.fillStyle = colors[i]
        ctx.beginPath()
        ctx.arc(x, 350, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        box(x - 97, y, 194, 155, colors[i], 'Milestone ' + (i + 1))
      })
      break
    }
  }
}

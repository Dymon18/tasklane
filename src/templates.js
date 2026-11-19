export const frameworks = {
  blank: 'Blank whiteboard',
  swot: 'SWOT',
  eisenhower: 'Eisenhower matrix',
  kanban: 'Kanban',
  northstar: 'North Star',
  timeline: 'Timeline / milestones',
  gantt: 'Gantt chart',
  impact: 'Impact / effort',
  rice: 'RICE scoring',
  swimlane: 'Swimlane',
  timeblock: 'Time-blocking calendar',
  mindmap: 'Mind map',
}

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
  function grid(columns, rows, left = 44) {
    const top = 54, right = 1156, bottom = 654
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
    case 'rice':
      grid(['Initiative', 'Reach', 'Impact', 'Confidence', 'Effort', 'RICE score'], Array(7).fill(''))
      text('Reach × Impact × Confidence ÷ Effort', 600, 27, 'center', 22)
      break
    case 'swimlane':
      grid(['Intake', 'Ready', 'In progress', 'Review', 'Done'], ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4'], 140)
      break
    case 'timeblock':
      grid(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'], 105)
      break
    case 'northstar': {
      box(395, 58, 410, 140, colors[1], 'North Star metric')
      line(600, 198, 600, 286)
      line(213, 286, 987, 286)
      const drivers = [213, 600, 987]
      drivers.forEach((x, i) => {
        line(x, 286, x, 340)
        box(x - 169, 340, 338, 274, colors[i + 2], 'Driver ' + (i + 1))
      })
      break
    }
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
    case 'mindmap':
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i
        const x = 600 + Math.cos(angle) * 420
        const y = 350 + Math.sin(angle) * 275
        line(600, 350, x, y)
        box(x - 103, y - 40, 206, 80, colors[i % colors.length], 'Branch ' + (i + 1))
      }
      ctx.fillStyle = '#dcece4'
      ctx.beginPath()
      ctx.ellipse(600, 350, 146, 72, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      text('Central idea', 600, 350)
      break
  }
}

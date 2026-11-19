export const inset = 4
export const clampPosition = (value) => Math.max(0, Math.min(1, value))

export function matrixSpace(width, height, size) {
  return { width: Math.max(0, width - inset * 2 - size), height: Math.max(0, height - inset * 2 - size), size }
}

export function fitsMatrix(position, others, { width, height, size }) {
  return others.every((other) => {
    const overlapX = Math.max(0, size - Math.abs(position.x - other.x) * width)
    const overlapY = Math.max(0, size - Math.abs(position.y - other.y) * height)
    return overlapX * overlapY <= size * size / 2
  })
}

export function randomPosition() {
  return { x: Math.random(), y: Math.random() }
}

export function findMatrixSpot(others, space, random = false, preferred) {
  if (random) {
    for (let attempt = 0; attempt < 48; attempt++) {
      const position = randomPosition()
      if (fitsMatrix(position, others, space)) return position
    }
  }
  const columns = Math.ceil(space.width / (space.size / 3))
  const rows = Math.ceil(space.height / (space.size / 3))
  const count = (columns + 1) * (rows + 1)
  const start = preferred ? Math.round(preferred.y * rows) * (columns + 1) + Math.round(preferred.x * columns)
    : random ? Math.floor(Math.random() * count) : 0
  for (let offset = 0; offset < count; offset++) {
    const index = (start + offset) % count
    const position = { x: columns ? index % (columns + 1) / columns : 0,
      y: rows ? Math.floor(index / (columns + 1)) / rows : 0 }
    if (fitsMatrix(position, others, space)) return position
  }
  return null
}

export function arrangeMatrix(preferred, width, height, maxSize) {
  const side = Math.ceil(Math.sqrt(preferred.length))
  const fallbackSize = Math.min(maxSize, (Math.min(width, height) - inset * 2) / side)
  // Keep saved placements where they fit. Repack only when the current area is too small.
  for (const size of [maxSize, Math.max(fallbackSize, maxSize * .8)]) {
    const space = matrixSpace(width, height, size)
    const occupied = []
    const positions = preferred.map((position) => {
      if (!position || !fitsMatrix(position, occupied, space)) return null
      occupied.push(position)
      return position
    })
    for (let index = 0; index < positions.length; index++) {
      if (positions[index]) continue
      const next = findMatrixSpot(occupied, space, false, preferred[index])
      if (!next) break
      positions[index] = next
      occupied.push(next)
    }
    if (positions.every(Boolean)) return { size, positions }
  }
  return {
    size: fallbackSize,
    positions: preferred.map((_, index) => ({
      x: side > 1 ? (index % side) / (side - 1) : 0,
      y: side > 1 ? Math.floor(index / side) / (side - 1) : 0,
    })),
  }
}

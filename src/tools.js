const byId = (id) => document.getElementById(id)
const defaultOptions = 'Take a walk\nRead a chapter\nStart the next task'
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const wheelColors = ['#f6c9ba', '#b8d7e0', '#f5dc9d', '#cfdfba', '#dacbec', '#efd1a8']

export function createTools({ get, update }) {
  const resetExtraTools = createExtraTools()
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
      resetExtraTools()
    },
  }
}

export { defaultOptions }

function createExtraTools() {
  const diceForm = byId('dice-form')
  const randomForm = byId('random-form')
  const timerForm = byId('timer-form')
  const eitherForm = byId('either-form')
  const bracketForm = byId('bracket-form')
  const diceFaces = byId('dice-faces')
  const diceResult = byId('dice-result')
  const randomResult = byId('random-result')
  const eitherResult = byId('either-result')
  const draw = (min, max) => min + Math.floor(Math.random() * (max - min + 1))

  diceForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const count = Number(byId('dice-count').value)
    const sides = Number(byId('dice-sides').value)
    const rolls = Array.from({ length: count }, () => draw(1, sides))
    diceFaces.replaceChildren(...rolls.map((roll) => {
      const die = document.createElement('span')
      die.className = 'die'
      die.textContent = roll
      return die
    }))
    diceResult.textContent = `Rolled ${rolls.join(', ')}. Total ${rolls.reduce((sum, roll) => sum + roll, 0)}.`
  })
  randomForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const min = Number(byId('random-min').value)
    const max = Number(byId('random-max').value)
    randomResult.textContent = min <= max ? String(draw(min, max))
      : 'Set the minimum to a number less than or equal to the maximum.'
  })
  eitherForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const picks = ['either-a', 'either-b'].map((id) => byId(id).value.trim())
    eitherResult.textContent = picks.every(Boolean) ? picks[draw(0, 1)] : 'Enter two options first.'
  })

  const minute = byId('timer-min')
  const second = byId('timer-sec')
  const start = byId('timer-start')
  const pause = byId('timer-pause')
  const clock = byId('timer-clock')
  const timerResult = byId('timer-result')
  let remaining = null
  let end = null
  let ticker
  const duration = () => (Number(minute.value) * 60 + Number(second.value)) * 1000

  function showTime(milliseconds) {
    const seconds = Math.ceil(Math.max(0, milliseconds) / 1000)
    clock.textContent = [Math.floor(seconds / 60), seconds % 60].map((part) => String(part).padStart(2, '0')).join(':')
  }
  function showTimerState() {
    start.disabled = Boolean(end)
    pause.disabled = !end
    start.textContent = remaining === null ? 'Start' : 'Resume'
    minute.disabled = second.disabled = Boolean(end)
  }
  function resetTimer() {
    clearInterval(ticker)
    end = null
    remaining = null
    showTime(duration())
    showTimerState()
    timerResult.textContent = ''
  }
  function tick() {
    const timeLeft = end - Date.now()
    showTime(timeLeft)
    if (timeLeft > 0) return
    clearInterval(ticker)
    end = null
    remaining = null
    showTimerState()
    timerResult.textContent = 'Time’s up!'
  }
  timerForm.addEventListener('submit', (event) => {
    event.preventDefault()
    if (end) return
    const value = remaining ?? duration()
    if (!value) {
      timerResult.textContent = 'Enter a countdown longer than zero seconds.'
      return
    }
    end = Date.now() + value
    showTime(value)
    showTimerState()
    timerResult.textContent = 'Countdown running.'
    ticker = setInterval(tick, 200)
  })
  pause.addEventListener('click', () => {
    if (!end) return
    if (end <= Date.now()) {
      tick()
      return
    }
    remaining = end - Date.now()
    end = null
    clearInterval(ticker)
    showTime(remaining)
    showTimerState()
    timerResult.textContent = 'Countdown paused.'
  })
  byId('timer-reset').addEventListener('click', resetTimer)
  for (const input of [minute, second]) input.addEventListener('input', resetTimer)

  const entrants = byId('bracket-options')
  const bracket = byId('bracket-rounds')
  const bracketResult = byId('bracket-result')
  let names = []
  const picks = new Map()

  function renderBracket(bracketFocus) {
    const size = 2 ** Math.ceil(Math.log2(names.length))
    let slots = Array.from({ length: size / 2 }, (_, index) => [names[index], names[index + size / 2]])
    bracket.replaceChildren()
    let focus
    for (let round = 0; slots.length; round++) {
      const column = document.createElement('section')
      column.className = 'bracket-round'
      const heading = document.createElement('h3')
      heading.textContent = slots.length === 1 ? 'Final' : 'Round ' + (round + 1)
      column.append(heading)
      const winners = slots.map(([left, right], index) => {
        const match = document.createElement('div')
        match.className = 'bracket-match'
        column.append(match)
        const id = round + '-' + index
        if (round === 0 && !right) {
          const bye = document.createElement('p')
          bye.textContent = left + ' advances with a bye.'
          match.append(bye)
          return left
        }
        if (!left || !right) {
          picks.delete(id)
          const upcoming = document.createElement('p')
          upcoming.textContent = left || right
            ? (left || right) + ' awaits an opponent.'
            : 'Awaiting winners.'
          match.append(upcoming)
          return null
        }
        const previous = picks.get(id)
        const selected = previous?.left === left && previous.right === right ? previous.name : null
        if (!selected) picks.delete(id)
        for (const name of [left, right]) {
          const choose = document.createElement('button')
          choose.type = 'button'
          choose.className = 'button neutral'
          choose.textContent = name
          choose.setAttribute('aria-label', 'Advance ' + name)
          choose.setAttribute('aria-pressed', String(selected === name))
          choose.addEventListener('click', () => {
            picks.set(id, { left, right, name })
            renderBracket({ id, name })
          })
          match.append(choose)
          if (bracketFocus?.id === id && bracketFocus.name === name) focus = choose
        }
        return selected
      })
      bracket.append(column)
      if (winners.length === 1) {
        bracketResult.textContent = winners[0] ? winners[0] + ' wins the tournament.'
          : 'Choose a winner from each match.'
        break
      }
      slots = Array.from({ length: winners.length / 2 }, (_, index) => winners.slice(index * 2, index * 2 + 2))
    }
    focus?.focus()
  }

  bracketForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const entered = entrants.value.split('\n').map((name) => name.trim()).filter(Boolean)
    if (entered.length < 2 || entered.length > 16 || new Set(entered.map((name) => name.toLowerCase())).size !== entered.length) {
      bracketResult.textContent = 'Enter 2–16 different names, one per line.'
      return
    }
    names = entered
    picks.clear()
    renderBracket()
  })

  return () => {
    for (const form of [diceForm, randomForm, timerForm, eitherForm, bracketForm]) form.reset()
    for (const result of [diceResult, randomResult, eitherResult, bracketResult]) result.textContent = ''
    resetTimer()
    diceFaces.replaceChildren()
    bracket.replaceChildren()
    names = []
    picks.clear()
  }
}

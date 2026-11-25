import { expect, test } from 'claude-code/testing'

const NOW = Date.parse('2026-11-25T17:30:00Z')
const BAND = {
  plugin: 'usage-bars',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10, bodyColumns: 100 },
} as const

// The first track's dots for a 5-hour reading: green behind Pac-Man, grey ahead
async function draw($: any, on: any, fiveHour: number) {
  on('clock.now', () => ({ value: NOW }))
  on('session.usage', () => ({
    value: {
      startedAt: NOW,
      context: { percent: 20 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: fiveHour, resetsAt: '2026-11-25T21:00:00Z' },
        { kind: 'seven_day', percentUsed: 42, resetsAt: '2026-11-30T17:00:00Z' },
      ],
    },
  }))
  const ui = await $.ui.mount(BAND as never)
  const src = String((await ui.findAll({ type: 'Svg' }))[0]?.props.source ?? '')
  await ui.unmount()
  // Only the first track: everything before the 7-day label
  const first = src.slice(0, src.indexOf('>7d<'))
  const pacX = Number(first.match(/fill="#f2c230" d="M([\d.]+) /)?.[1])
  const green = [...first.matchAll(/class="eaten" cx="([\d.]+)"/g)].map(m => Number(m[1]))
  const grey = [...first.matchAll(/class="dot" cx="([\d.]+)"/g)].map(m => Number(m[1]))
  return { pacX, green, grey }
}

for (const pct of [5, 48, 90]) {
  test(`at ${pct}% of the 5-hour window, about ${pct}% of the dots are green`, async ($, on) => {
    const { pacX, green, grey } = await draw($, on, pct)
    expect(green.every(x => x < pacX)).toBe(true)
    expect(grey.every(x => x > pacX)).toBe(true)
    // the dot or two under Pac-Man himself are hidden, so allow a little slack
    expect(Math.abs(green.length / (green.length + grey.length) - pct / 100)).toBeLessThan(0.12)
  })
}

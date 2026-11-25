import type { Register, SessionUsage } from 'claude-code'

// Adapted from desktop-usage-strip (awesome-claude-code-mods, MIT): same data,
// one-line layout. Each plan window is a Pac-Man eating a row of dots; context
// is a chip, and hovering it reveals the token counts beside it.

type Totals = { input: number; output: number; cache: number }
type Drawing = { source: string; alt: string; width: number; height: number }
type Limit = { kind: string; percentUsed: number; resetsAt?: string }

const COMMAND = 'usage-bars'
const WINDOWS: Record<string, string> = { five_hour: '5h', seven_day: '7d' }
const CHIP_COLOR = '#cbd5ed'
const PAC_COLOR = '#f2c230'
const GHOST_COLOR = '#e0625a'

// Row geometry, in CSS pixels
const ROW = 14
const MID = ROW / 2
const PAC_R = 4.5
const DOT_GAP = 8
const LABEL_W = 34
const CLOCK_W = 50
const WINDOW_GAP = 14

const STYLE =
  '<style>text{font-family:system-ui,-apple-system,sans-serif;font-size:11px}' +
  '.label{fill:#6b7280}.strong{font-weight:600;fill:#374151}.dot{fill:#a3a9b3}' +
  '@media (prefers-color-scheme:dark){.label{fill:#9ca3af}.strong{fill:#e5e7eb}.dot{fill:#6b7280}}</style>'

// Token totals for the latest 30 requests seen since the mod loaded
let records: Totals[] = []
let isHidden = false
// The last plan-window reading, kept across sessions: a new session has none until its first reply
let saved: Limit[] = []

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const xml = (v: string) =>
  v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)

function compact(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

function resetIn(resetsAt: string | undefined, now: number) {
  const at = resetsAt ? Date.parse(resetsAt) : NaN
  if (!Number.isFinite(at)) return ''
  const minutes = Math.max(0, Math.ceil((at - now) / 60000))
  if (minutes === 0) return 'resetting'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`
}

function svg(width: number, body: string, alt: string): Drawing {
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ROW}" viewBox="0 0 ${width} ${ROW}">${STYLE}${body}</svg>`,
    alt,
    width,
    height: ROW,
  }
}

// Pac-Man facing right, mouth opened to `deg` degrees either side
function pacPath(cx: number, deg: number) {
  const a = (deg * Math.PI) / 180
  const x = (cx + PAC_R * Math.cos(a)).toFixed(2)
  const dy = PAC_R * Math.sin(a)
  return `M${cx.toFixed(2)} ${MID}L${x} ${(MID - dy).toFixed(2)}A${PAC_R} ${PAC_R} 0 1 0 ${x} ${(MID + dy).toFixed(2)}Z`
}

function ghost(x: number) {
  const bottom = MID + 4.5
  return (
    `<path d="M${x - 4.5} ${bottom}V${MID}a4.5 4.5 0 0 1 9 0V${bottom}l-1.5-1.3-1.5 1.3-1.5-1.3-1.5 1.3-1.5-1.3Z" fill="${GHOST_COLOR}"/>` +
    `<circle cx="${x - 1.8}" cy="${MID - 0.5}" r="1.2" fill="#fff"/><circle cx="${x + 1.8}" cy="${MID - 0.5}" r="1.2" fill="#fff"/>`
  )
}

// One plan window: label, a row of dots Pac-Man has eaten up to the percent used, reset clock
function track(x: number, label: string, percent: number, clock: string, trackW: number) {
  const shown = Math.max(0, Math.min(100, percent))
  const start = x + LABEL_W
  const pacX = start + PAC_R + ((trackW - 2 * PAC_R) * shown) / 100
  const dots: string[] = []
  for (let dx = start + DOT_GAP / 2; dx < start + trackW; dx += DOT_GAP) {
    if (dx > pacX + PAC_R) dots.push(`<circle class="dot" cx="${dx.toFixed(1)}" cy="${MID}" r="1.2"/>`)
  }
  // Past 80% a ghost chases Pac-Man, a step behind him
  const chaser = shown >= 80 ? ghost(Math.max(start + 4.5, pacX - PAC_R - 8)) : ''
  const body =
    `<text class="label" x="${x}" y="${MID + 4}"><tspan class="strong">${label}</tspan> ${Math.round(percent)}%</text>` +
    dots.join('') +
    chaser +
    `<path fill="${PAC_COLOR}" d="${pacPath(pacX, 35)}"/>` +
    `<text class="label" x="${start + trackW + 6}" y="${MID + 4}">${xml(clock)}</text>`
  return { body, alt: `${label} window: ${percent}% used` + (clock ? `, resets in ${clock}` : '') }
}

function draw(usage: SessionUsage, limits: Limit[], now: number, width: number) {
  const totals = records.reduce(
    (a, r) => ({ input: a.input + r.input, output: a.output + r.output, cache: a.cache + r.cache }),
    { input: 0, output: 0, cache: 0 },
  )
  const contextPercent = usage.context?.percent
  const context = 'Context ' + (typeof contextPercent === 'number' ? Math.round(contextPercent) + '%' : '–')
  const tokens = `in ${compact(totals.input)} · out ${compact(totals.output)} · cache ${compact(totals.cache)}`
  const windows = limits.filter(r => WINDOWS[r.kind])

  // Shrink the dot rows to keep the line whole, down to a floor
  const chipW = context.length * 6 + 14
  const tokensW = tokens.length * 5.6 + 8
  const fixed = windows.length * (LABEL_W + CLOCK_W + WINDOW_GAP) + chipW + tokensW
  const trackW = Math.max(60, Math.min(140, windows.length ? (width - fixed) / windows.length : 0))

  const bodies: string[] = []
  const alts: string[] = []
  let x = 0
  for (const r of windows) {
    const t = track(x, WINDOWS[r.kind]!, num(r.percentUsed), resetIn(r.resetsAt, now), trackW)
    bodies.push(t.body)
    alts.push(t.alt)
    x += LABEL_W + trackW + CLOCK_W + WINDOW_GAP
  }

  return {
    bars: windows.length ? svg(Math.ceil(x - WINDOW_GAP), bodies.join(''), alts.join('; ')) : null,
    chip: svg(
      chipW,
      `<rect x="0" y="0" width="${chipW}" height="${ROW}" rx="${MID}" fill="${CHIP_COLOR}"/>` +
        `<text x="7" y="${MID + 4}" fill="#202523">${xml(context)}</text>`,
      context,
    ),
    tokens: svg(Math.ceil(tokensW), `<text class="label" x="6" y="${MID + 4}">${xml(tokens).replace(/·/g, '&#183;')}</text>`, 'Tokens ' + tokens),
  }
}

export const register: Register = on => {
  let surface: string | null = null

  on('session.start', async ($, e, next) => {
    surface = e.surface
    const stored = await $.store.get('rateLimits')
    if (Array.isArray(stored)) {
      saved = stored.filter(
        (r): r is Limit => typeof r?.kind === 'string' && typeof r?.percentUsed === 'number',
      )
    }
    await $.command.register({
      name: COMMAND,
      description: 'Show or hide the usage bars above the prompt',
      immediate: true,
    })
    // Keep the reset clocks ticking between turns
    $.clock.every(60000, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    if (surface !== 'desktop') return { text: 'usage-bars draws in the Claude Desktop Code tab.' }
    isHidden = !isHidden
    $.ui.invalidate('ui.render')

    return { text: isHidden ? 'Usage bars hidden.' : 'Usage bars shown.' }
  })

  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (r.usage) {
      const u = r.usage
      records = [
        ...records,
        { input: num(u.input_tokens), output: num(u.output_tokens), cache: num(u.cache_read_input_tokens) },
      ].slice(-30)
      const live = (await $.session.usage()).rateLimits
      if (live.length) {
        saved = live.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt }))
        await $.store.set('rateLimits', saved)
      }
      $.ui.invalidate('ui.render')
    }

    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const downstream = await next(e)
    if (e.surface !== 'desktop' || isHidden || e.props.hasSurvey) return downstream

    const { Box, Svg } = $.ui.resolve(e)
    const width = Math.min(1000, Math.max(240, (e.props.bodyColumns || 80) * 8))
    const usage = await $.session.usage()
    const now = await $.clock.now()
    // Until this session's first reply, fall back to the saved reading while its windows are still open
    const limits = usage.rateLimits.length
      ? usage.rateLimits
      : saved.filter(r => r.resetsAt && Date.parse(r.resetsAt) > now)
    const d = draw(usage, limits, now, width)

    // The keyed Box is the hover scope: over the chip, the token counts appear beside it
    const context = Box({
      key: 'context',
      flexDirection: 'row',
      alignItems: 'center',
      children: [Svg(d.chip), Box({ display: 'none', hover: { display: 'flex' }, children: [Svg(d.tokens)] })],
    })
    const line = Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 'md',
      children: [...(d.bars ? [Svg(d.bars)] : []), context],
    })

    return downstream ? Box({ flexDirection: 'column', gap: 1, children: [line, downstream] }) : line
  })
}

import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'prompt-master',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10 },
} as const

test('no button over an empty prompt box', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'prompt-master' })).toBe(undefined)
  await ui.unmount()
})

test('pressing the button rewrites the draft and offers Undo', async ($, on) => {
  let box = 'make me a thing that does emails'
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }))
  on('model.complete', () => ({
    value: { isAnswered: true, text: 'I need a tool that drafts emails. [audience]', usage: {} },
  }))
  on('prompt.fill', (_, e) => {
    box = e.text
    return { isFilled: true }
  })
  on('prompt.edit', (_, e) => ({ text: e.inputText, cursor: e.inputText.length }))
  // Stands for another mod in the band (usage-bars): it must stay drawn.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>other mod</Text>
  })

  await $.prompt.edit({
    origin: { kind: 'keys' },
    text: '',
    cursor: 0,
    start: 0,
    end: 0,
    inputText: box,
  } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Button', key: 'prompt-master' })).not.toBe(undefined)
    expect((await ui.find({ type: 'Text', text: /other mod/ }))?.text).toBe('other mod')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'prompt-master' })
  expect(box).toBe('I need a tool that drafts emails. [audience]')
  await ui.press({ key: 'undo' })
  expect(box).toBe('make me a thing that does emails')
  await ui.unmount()
})

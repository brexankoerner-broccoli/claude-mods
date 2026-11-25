export type Phase = 'idle' | 'rewriting'

declare module 'claude-code' {
  interface PluginState {
    'prompt-master': {
      hasDraft: boolean
      phase: Phase
      original: string | null
    }
  }
}

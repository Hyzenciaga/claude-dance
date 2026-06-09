import { describe, expect, it } from 'vitest'
import { encodeCwd, decodeCwd } from '@shared/encoding'

describe('encodeCwd', () => {
  it('replaces / with -', () => {
    expect(encodeCwd('/Users/steve/CodeFiles/ClaudeCode/ClaudeDance')).toBe(
      '-Users-steve-CodeFiles-ClaudeCode-ClaudeDance',
    )
  })
  it('handles trailing slash', () => {
    expect(encodeCwd('/Users/steve/')).toBe('-Users-steve')
  })
  it('handles root', () => {
    expect(encodeCwd('/')).toBe('-')
  })
})

describe('decodeCwd', () => {
  it('replaces - with /', () => {
    expect(decodeCwd('-Users-steve-CodeFiles-ClaudeCode-ClaudeDance')).toBe(
      '/Users/steve/CodeFiles/ClaudeCode/ClaudeDance',
    )
  })
})

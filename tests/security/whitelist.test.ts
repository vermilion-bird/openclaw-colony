import { describe, test, expect } from 'vitest'
import { WhitelistManager, getDefaultConfig } from '@/lib/security/config/whitelist'

describe('Whitelist Configuration', () => {
  test('getDefaultConfig returns valid structure', () => {
    const config = getDefaultConfig()
    expect(config.enabled).toBe(true)
    expect(config.whitelist.channels).toEqual([])
    expect(config.inputGuard.enabled).toBe(true)
  })

  test('isWhitelisted returns true for channel in whitelist', () => {
    const manager = new WhitelistManager()
    manager.addToWhitelist('channel', 'test_channel')
    expect(manager.isWhitelisted('test_channel', 'user1')).toBe(true)
  })

  test('isWhitelisted returns true for user in whitelist', () => {
    const manager = new WhitelistManager()
    manager.addToWhitelist('user', 'test_user')
    expect(manager.isWhitelisted('channel1', 'test_user')).toBe(true)
  })

  test('isWhitelisted returns false when not in whitelist', () => {
    const manager = new WhitelistManager()
    expect(manager.isWhitelisted('unknown_channel', 'unknown_user')).toBe(false)
  })

  test('isWhitelisted respects enabled flag', () => {
    const manager = new WhitelistManager()
    manager.config.enabled = false
    expect(manager.isWhitelisted('any', 'any')).toBe(true)
  })

  test('addToWhitelist and removeFromWhitelist work correctly', () => {
    const manager = new WhitelistManager()
    manager.addToWhitelist('channel', 'ch1')
    manager.addToWhitelist('user', 'u1')
    expect(manager.isWhitelisted('ch1', 'u1')).toBe(true)

    manager.removeFromWhitelist('channel', 'ch1')
    expect(manager.isWhitelisted('ch1', 'u1')).toBe(true) // user still whitelisted

    manager.removeFromWhitelist('user', 'u1')
    expect(manager.isWhitelisted('ch1', 'u1')).toBe(false)
  })
})
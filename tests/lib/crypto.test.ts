import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
})

const { encrypt, decrypt } = await import('@/lib/crypto')

describe('crypto', () => {
  it('encrypts and decrypts a string', () => {
    const plain = 'sk-my-secret-api-key'
    const ciphertext = encrypt(plain)
    expect(ciphertext).not.toBe(plain)
    expect(decrypt(ciphertext)).toBe(plain)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const plain = 'same-input'
    expect(encrypt(plain)).not.toBe(encrypt(plain))
  })

  it('throws on wrong key for decrypt', () => {
    const ciphertext = encrypt('hello')
    process.env.ENCRYPTION_KEY = 'b'.repeat(64)
    expect(() => decrypt(ciphertext)).toThrow()
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  })
})

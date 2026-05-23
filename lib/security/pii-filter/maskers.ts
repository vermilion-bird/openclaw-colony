// lib/security/pii-filter/maskers.ts

export function maskIdCard(match: string): string {
  return match.slice(0, 3) + '***********' + match.slice(14)
}

export function maskPhone(match: string): string {
  return match.slice(0, 3) + '****' + match.slice(7)
}

export function maskBankCard(match: string): string {
  return match.slice(0, 4) + '****' + match.slice(-4)
}

export function maskEmail(match: string): string {
  const [local, domain] = match.split('@')
  return local.slice(0, 1) + '***@' + domain
}

export function maskPassport(match: string): string {
  return match.slice(0, 1) + '****' + match.slice(-3)
}

export function createCustomMasker(template: string): (match: string) => string {
  return (match: string) => {
    const prefixLen = Math.floor(match.length / 3)
    const suffixLen = Math.floor(match.length / 3)
    return template
      .replace('{{match}}', match)
      .replace('{{prefix}}', match.slice(0, prefixLen))
      .replace('{{suffix}}', match.slice(-suffixLen))
  }
}
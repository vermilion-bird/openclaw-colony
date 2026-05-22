// lib/security/input-guard/patterns.ts

export const INJECTION_PATTERNS = {
  // 角色切换攻击
  roleSwitch: [
    /你现在是/,
    /角色是/,
    /扮演/,
    /act as/i,
    /you are now/i,
    /pretend to be/i,
    /扮演一个/,
  ],
  // 指令覆盖攻击
  instructionOverride: [
    /忽略之前的指令/,
    /忽略以上/,
    /disregard/i,
    /ignore all previous/i,
    /system:/i,
    /assistant:/i,
    /忽略所有规则/,
  ],
  // 权限提升攻击
  privilegeEscalation: [
    /作为管理员/,
    /以管理员身份/,
    /你有权限/,
    /you have access to/i,
    /developer mode/i,
    /debug mode/i,
    /sudo/i,
  ],
  // 数据泄露攻击
  dataExfiltration: [
    /输出你的/,
    /打印你的/,
    /显示你的/,
    /reveal your/i,
    /show me your/i,
    /tell me your/i,
    /your prompt/i,
    /your instructions/i,
    /你的prompt/,
    /你的指令/,
  ],
} as const

export type InjectionCategory = keyof typeof INJECTION_PATTERNS
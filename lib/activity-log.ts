import { prisma } from './db'

export type EventCategory = 'AUTH' | 'OPENCLAW' | 'IMAGE' | 'USER' | 'CONFIG' | 'DATA'

export type EventType =
  // AUTH
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  // OPENCLAW
  | 'openclaw.create'
  | 'openclaw.delete'
  | 'openclaw.start'
  | 'openclaw.stop'
  | 'openclaw.restart'
  // IMAGE
  | 'image.import'
  | 'image.activate'
  | 'image.delete'
  // USER
  | 'user.create'
  | 'user.disable'
  | 'user.enable'
  | 'user.role_change'
  | 'user.delete'
  // CONFIG
  | 'config.update'
  // DATA
  | 'data.download'
  | 'data.export'
  | 'data.view'

export interface ActivityLogInput {
  userId?: string
  userName: string
  userEmail: string
  eventCategory: EventCategory
  eventType: EventType
  eventDesc: string
  targetType?: string
  targetId?: string
  targetName?: string
  result: 'success' | 'failure'
  failReason?: string
  ipAddress?: string
  userAgent?: string
  extra?: Record<string, unknown>
}

export async function logActivity(input: ActivityLogInput): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId: input.userId ?? null,
      userName: input.userName,
      userEmail: input.userEmail,
      eventCategory: input.eventCategory,
      eventType: input.eventType,
      eventDesc: input.eventDesc,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      targetName: input.targetName ?? null,
      result: input.result,
      failReason: input.failReason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      extra: input.extra ? JSON.stringify(input.extra) : null,
    },
  })
}
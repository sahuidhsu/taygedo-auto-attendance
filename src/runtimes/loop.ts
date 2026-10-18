import { shanghaiDateTime } from '../utils/time.js'

export interface DailySchedule {
  hour: number
  minute: number
}

export interface LoopRunnerOptions {
  loopSeconds?: number
  dailyAt?: DailySchedule
  runOnce: () => Promise<void>
  schedule?: (callback: () => void, delayMs: number) => unknown
  log?: (message: string) => void
}

const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function nextDailyRunAt(dailyAt: DailySchedule, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '01'
  const todayRunAtUtcMs = Date.UTC(
    Number(value('year')),
    Number(value('month')) - 1,
    Number(value('day')),
    dailyAt.hour,
    dailyAt.minute,
  ) - SHANGHAI_UTC_OFFSET_MS
  const nextRunAtUtcMs = todayRunAtUtcMs > now.getTime() ? todayRunAtUtcMs : todayRunAtUtcMs + DAY_MS
  return new Date(nextRunAtUtcMs)
}

export function msUntilDailySchedule(dailyAt: DailySchedule, now = new Date()): number {
  return nextDailyRunAt(dailyAt, now).getTime() - now.getTime()
}

export function formatDailySchedule(dailyAt: DailySchedule): string {
  const hour = String(dailyAt.hour).padStart(2, '0')
  const minute = String(dailyAt.minute).padStart(2, '0')
  return `${hour}:${minute}`
}

export async function runWithOptionalLoop(options: LoopRunnerOptions): Promise<void> {
  const log = options.log ?? ((message: string) => console.log(message))

  if (options.dailyAt) {
    const dailyAt = options.dailyAt
    const schedule = options.schedule ?? setTimeout
    log(`定时模式：每日 ${formatDailySchedule(dailyAt)}（Asia/Shanghai）自动执行`)
    await options.runOnce()
    const arm = () => {
      const nextRunAt = nextDailyRunAt(dailyAt)
      const delayMs = nextRunAt.getTime() - Date.now()
      log(`下次执行时间：${shanghaiDateTime(nextRunAt)}`)
      schedule(() => {
        options.runOnce()
          .catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : String(error))
          })
          .finally(() => {
            arm()
          })
      }, delayMs)
    }
    arm()
    return
  }

  await options.runOnce()
  if (!options.loopSeconds) {
    return
  }

  const schedule = options.schedule ?? setTimeout
  const nextRunAt = new Date(Date.now() + options.loopSeconds * 1000)
  log(`循环模式：每 ${options.loopSeconds} 秒执行一次，下次执行时间：${shanghaiDateTime(nextRunAt)}`)
  schedule(() => {
    runWithOptionalLoop(options).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
    })
  }, options.loopSeconds * 1000)
}

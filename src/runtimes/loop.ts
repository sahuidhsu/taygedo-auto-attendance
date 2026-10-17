export interface DailySchedule {
  hour: number
  minute: number
}

export interface LoopRunnerOptions {
  loopSeconds?: number
  dailyAt?: DailySchedule
  runOnce: () => Promise<void>
  schedule?: (callback: () => void, delayMs: number) => unknown
}

const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function msUntilDailySchedule(dailyAt: DailySchedule, now = new Date()): number {
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
  return nextRunAtUtcMs - now.getTime()
}

export async function runWithOptionalLoop(options: LoopRunnerOptions): Promise<void> {
  if (options.dailyAt) {
    await options.runOnce()
    const schedule = options.schedule ?? setTimeout
    const dailyAt = options.dailyAt
    const arm = () => {
      schedule(() => {
        options.runOnce().catch((error: unknown) => {
          console.error(error instanceof Error ? error.message : String(error))
        }).finally(() => {
          arm()
        })
      }, msUntilDailySchedule(dailyAt))
    }
    arm()
    return
  }

  await options.runOnce()
  if (!options.loopSeconds) {
    return
  }

  const schedule = options.schedule ?? setTimeout
  schedule(() => {
    runWithOptionalLoop(options).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
    })
  }, options.loopSeconds * 1000)
}

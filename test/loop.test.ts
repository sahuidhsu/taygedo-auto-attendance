import { describe, expect, it, vi } from 'vitest'
import { msUntilDailySchedule, runWithOptionalLoop } from '../src/runtimes/loop.js'

describe('msUntilDailySchedule', () => {
  it('returns the delay to today when the scheduled time has not passed', () => {
    const now = new Date('2026-10-18T05:00:00Z') // 13:00 Asia/Shanghai
    expect(msUntilDailySchedule({ hour: 20, minute: 0 }, now)).toBe(7 * 60 * 60 * 1000)
  })

  it('returns the delay to tomorrow when today time has passed', () => {
    const now = new Date('2026-10-18T05:00:00Z') // 13:00 Asia/Shanghai
    expect(msUntilDailySchedule({ hour: 9, minute: 30 }, now)).toBe(20.5 * 60 * 60 * 1000)
  })

  it('schedules to the next day when the time equals now exactly', () => {
    const now = new Date('2026-10-18T01:30:00Z') // 09:30 Asia/Shanghai
    expect(msUntilDailySchedule({ hour: 9, minute: 30 }, now)).toBe(24 * 60 * 60 * 1000)
  })
})

describe('runWithOptionalLoop', () => {
  it('runs once when no loop seconds are configured', async () => {
    const runOnce = vi.fn().mockResolvedValue(undefined)
    const schedule = vi.fn()

    await runWithOptionalLoop({ loopSeconds: undefined, runOnce, schedule })

    expect(runOnce).toHaveBeenCalledTimes(1)
    expect(schedule).not.toHaveBeenCalled()
  })

  it('runs immediately and schedules the next run in loop mode', async () => {
    const runOnce = vi.fn().mockResolvedValue(undefined)
    const schedule = vi.fn()

    await runWithOptionalLoop({ loopSeconds: 86400, runOnce, schedule })

    expect(runOnce).toHaveBeenCalledTimes(1)
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 86400 * 1000)
  })

  it('runs once at startup then repeats at the fixed daily time', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-18T05:00:00Z')) // 13:00 Asia/Shanghai
      const runOnce = vi.fn().mockResolvedValue(undefined)
      const schedule = vi.fn((callback: () => void, delayMs: number) => setTimeout(callback, delayMs))

      await runWithOptionalLoop({ dailyAt: { hour: 9, minute: 30 }, runOnce, schedule })

      expect(runOnce).toHaveBeenCalledTimes(1)
      expect(schedule).toHaveBeenCalledWith(expect.any(Function), 20.5 * 60 * 60 * 1000)

      await vi.advanceTimersByTimeAsync(20.5 * 60 * 60 * 1000)

      expect(runOnce).toHaveBeenCalledTimes(2)
      expect(schedule).toHaveBeenCalledTimes(2)
      expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), 24 * 60 * 60 * 1000)

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)

      expect(runOnce).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('prints the configured daily time at startup and the next run time after each execution', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-18T05:00:00Z')) // 13:00 Asia/Shanghai
      const messages: string[] = []
      const runOnce = vi.fn().mockResolvedValue(undefined)
      const schedule = vi.fn((callback: () => void, delayMs: number) => setTimeout(callback, delayMs))

      await runWithOptionalLoop({
        dailyAt: { hour: 9, minute: 30 },
        runOnce,
        schedule,
        log: message => messages.push(message),
      })

      expect(messages[0]).toContain('每日 09:30')
      expect(messages[1]).toContain('下次执行时间：2026-10-19T09:30:00+08:00')

      await vi.advanceTimersByTimeAsync(20.5 * 60 * 60 * 1000)

      expect(messages).toContain('下次执行时间：2026-10-20T09:30:00+08:00')
    } finally {
      vi.useRealTimers()
    }
  })

  it('prints the next run time in loop seconds mode', async () => {
    const messages: string[] = []
    const runOnce = vi.fn().mockResolvedValue(undefined)
    const schedule = vi.fn()

    await runWithOptionalLoop({ loopSeconds: 3600, runOnce, schedule, log: message => messages.push(message) })

    expect(messages[0]).toContain('每 3600 秒执行一次')
    expect(messages[0]).toContain('下次执行时间：')
  })

  it('prefers the daily schedule over loop seconds', async () => {
    const runOnce = vi.fn().mockResolvedValue(undefined)
    const schedule = vi.fn()

    await runWithOptionalLoop({ loopSeconds: 86400, dailyAt: { hour: 9, minute: 30 }, runOnce, schedule })

    expect(runOnce).toHaveBeenCalledTimes(1)
    expect(schedule).toHaveBeenCalledTimes(1)
  })
})

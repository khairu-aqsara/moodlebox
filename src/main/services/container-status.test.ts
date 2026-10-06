import { describe, it, expect, vi } from 'vitest'
import { summariseContainerStates } from './docker-service'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

const running = (
  Service: string,
  Health = ''
): { Service: string; State: string; Health: string } => ({
  Service,
  State: 'running',
  Health
})

describe('summariseContainerStates', () => {
  it('is healthy when moodle and db pass their health checks', () => {
    const s = summariseContainerStates([
      running('cron'),
      running('db', 'healthy'),
      running('moodle', 'healthy'),
      running('phpmyadmin')
    ])
    expect(s).toEqual({ running: true, healthy: true, unhealthy: false, containerCount: 4 })
  })

  it('is not healthy while the moodle health check is still pending', () => {
    const s = summariseContainerStates([
      running('cron'),
      running('db', 'healthy'),
      running('moodle', 'starting'),
      running('phpmyadmin')
    ])
    expect(s.healthy).toBe(false)
    expect(s.unhealthy).toBe(false)
  })

  it('is not healthy before the moodle container exists', () => {
    const s = summariseContainerStates([running('db', 'healthy'), running('phpmyadmin')])
    expect(s.running).toBe(true)
    expect(s.healthy).toBe(false)
  })

  it('reports a failed health check as unhealthy', () => {
    const s = summariseContainerStates([running('db', 'healthy'), running('moodle', 'unhealthy')])
    expect(s.healthy).toBe(false)
    expect(s.unhealthy).toBe(true)
  })

  it('is neither running nor healthy with no containers', () => {
    expect(summariseContainerStates([])).toEqual({
      running: false,
      healthy: false,
      unhealthy: false,
      containerCount: 0
    })
  })
})

import { describe, it, expect } from 'vitest'
import versionsData from '../../assets/versions.json'
import type { VersionsData } from './types'

const data = versionsData as VersionsData

describe('assets/versions.json', () => {
  it('lists Moodle 5.3 first, as an LTS with a public webroot and Composer', () => {
    const latest = data.releases[0]
    expect(latest.version).toBe('5.3')
    expect(latest.type).toBe('lts')
    expect(latest.webroot).toBe('public')
    expect(latest.composer).toBe(true)
    expect(latest.requirements.php).toBe('8.3')
    expect(latest.requirements.mysql).toBe('8.4')
  })

  it('keeps hidden versions in the list so existing projects can still start', () => {
    const v50 = data.releases.find((r) => r.version === '5.0')
    expect(v50).toBeDefined()
    expect(v50?.hidden).toBe(true)
  })

  it('only hides 5.0, and leaves at least one version selectable', () => {
    const hidden = data.releases.filter((r) => r.hidden).map((r) => r.version)
    expect(hidden).toEqual(['5.0'])
    expect(data.releases.filter((r) => !r.hidden).length).toBeGreaterThan(0)
  })

  it('has no duplicate versions', () => {
    const versions = data.releases.map((r) => r.version)
    expect(new Set(versions).size).toBe(versions.length)
  })
})

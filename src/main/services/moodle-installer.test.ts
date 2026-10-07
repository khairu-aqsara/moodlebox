import { describe, it, expect, vi } from 'vitest'
import { FINALISE_SITE_PHP } from './moodle-installer'

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))
vi.mock('../utils/asset-path', () => ({ getAssetPath: vi.fn() }))

describe('FINALISE_SITE_PHP', () => {
  it('runs as the admin user so every settings page is in the admin tree', () => {
    expect(FINALISE_SITE_PHP).toContain('\\core\\session\\manager::set_user(get_admin());')
    expect(FINALISE_SITE_PHP.indexOf('set_user(get_admin())')).toBeLessThan(
      FINALISE_SITE_PHP.indexOf('admin_apply_default_settings')
    )
  })

  it('applies defaults only to settings that have no value yet', () => {
    expect(FINALISE_SITE_PHP).toContain(
      'admin_apply_default_settings(admin_get_root(true, true), false);'
    )
  })

  it("enables the Moodle app through Moodle's own setting", () => {
    expect(FINALISE_SITE_PHP).toContain(
      "(new admin_setting_enablemobileservice('enablemobilewebservice', '', '', 0))->write_setting('1');"
    )
  })

  it('purges caches after changing settings', () => {
    expect(FINALISE_SITE_PHP.indexOf('purge_all_caches();')).toBeGreaterThan(
      FINALISE_SITE_PHP.indexOf('write_setting')
    )
  })
})

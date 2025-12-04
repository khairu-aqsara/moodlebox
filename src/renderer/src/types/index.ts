import { z } from 'zod'

export const MoodleVersionSchema = z.object({
  version: z.string(),
  type: z.enum(['lts', 'stable']),
  download: z.string(),
  requirements: z.object({
    php: z.string(),
    mariadb: z.string().optional(),
    mysql: z.string().optional(),
    postgres: z.string()
  }),
  webroot: z.string().optional(),
  composer: z.boolean().optional()
})

export const VersionsDataSchema = z.object({
  latest_update: z.string(),
  releases: z.array(MoodleVersionSchema)
})

export type MoodleVersion = z.infer<typeof MoodleVersionSchema>
export type VersionsData = z.infer<typeof VersionsDataSchema>

export interface Project {
  id: string
  name: string
  moodleVersion: string
  port: number
  status:
    | 'provisioning'
    | 'installing'
    | 'starting'
    | 'waiting'
    | 'ready'
    | 'stopped'
    | 'stopping'
    | 'deleting'
    | 'error'
  path: string
  createdAt: string
  lastUsed?: string
  errorMessage?: string
  progress?: ProgressInfo
  statusDetail?: string
}

export interface ProgressInfo {
  phase: string
  percentage?: number
  current?: number
  total?: number
  message?: string
}

/**
 * dsh-plugin-rdk — D-Robotics RDK integration for DeepSeek Harness.
 *
 * Mounts the `rdk-skills` provider into the harness-native skills registry so
 * the vendored RDK skill packs (rdk-device-skills + rdk-skills) appear in the
 * session skill catalog and load through the built-in `skill` tool, and
 * registers the `rdk_skills` catalog tool plus the `rdk_board_detect` device
 * detector.
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { mountRdkSkills } from './skill-provider.js'
import { registerTools } from './tools.js'

export const name = 'rdk-skills'

export interface Config {
  /** Extra skill directories scanned BEFORE the vendored packs; they win duplicate names. */
  skillsDirs: string[]
  /** Include the OE / X5 / S-series toolchain skills vendored from rdk-skills. */
  includeOe: boolean
  /** Custom board-detection script; defaults to the vendored detect_rdk.sh. */
  detectScript?: string
}

export const Config: Schema<Config> = Schema.object({
  skillsDirs: Schema.array(Schema.string()).default([]),
  includeOe: Schema.boolean().default(true),
  detectScript: Schema.string(),
})

export const inject = ['skills']

export function apply(ctx: Context, config: Config): void {
  const handle = mountRdkSkills(ctx, {
    skillsDirs: config.skillsDirs ?? [],
    includeOe: config.includeOe ?? true,
  })
  if (handle === undefined) {
    ctx.logger?.warn?.('dsh-plugin-rdk: skills service unavailable; RDK skills were not registered')
    return
  }
  registerTools(ctx, handle, config.detectScript)
}

export { parseDetectOutput, runDeviceDetect } from './device-detect.js'
export { mountRdkSkills, PROVIDER_NAME } from './skill-provider.js'

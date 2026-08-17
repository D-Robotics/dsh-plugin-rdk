/**
 * dsh-plugin-rdk — D-Robotics RDK integration for DeepSeek Harness.
 *
 * Mounts the `rdk-skills` provider into the harness-native skills registry so
 * the vendored RDK skill packs appear in the session skill catalog and load
 * through the built-in `skill` tool, and registers the `rdk_skills` catalog
 * tool, the `rdk_board_detect` device detector, and the `rdk_oe_setup`
 * workspace installer (runs the official OE pack setup.sh).
 */
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { mountRdkSkills, type SkillsRegistryView } from './skill-provider.js'
import { registerTools, type ToolsRegistryView } from './tools.js'

export const name = 'rdk-skills'

export interface Config {
  /** Extra skill directories scanned BEFORE the vendored packs; they win duplicate names. */
  skillsDirs: string[]
  /** Include the OpenExplorer toolchain packs (oe-skills-x5 / oe-skills-s). */
  includeOe: boolean
  /** Custom board-detection script; defaults to the vendored detect_rdk.sh. */
  detectScript?: string
  /** Custom git URL or local path for the oe-skills-x5 repository (used by rdk_oe_setup). */
  oeX5Source?: string
  /** Custom git URL or local path for the oe-skills-s repository (used by rdk_oe_setup). */
  oeSSource?: string
}

export const Config: Schema<Config> = Schema.object({
  skillsDirs: Schema.array(Schema.string()).default([]),
  includeOe: Schema.boolean().default(true),
  detectScript: Schema.string(),
  oeX5Source: Schema.string(),
  oeSSource: Schema.string(),
})

export function apply(ctx: Context, config: Config): void {
  // Declare hard dependencies so Cordis waits for these services and
  // re-activates the plugin when they appear — instead of silently
  // doing nothing because they happened to not be ready yet.
  const skills = ctx.get('skills') as SkillsRegistryView | undefined
  const tools = ctx.get('tools') as ToolsRegistryView | undefined

  if (skills === undefined || tools === undefined) {
    // Services not yet available; Cordis will re-invoke apply when they appear
    // because we declare them in inject below.
    return
  }

  const handle = mountRdkSkills(skills, {
    skillsDirs: config.skillsDirs ?? [],
    includeOe: config.includeOe ?? true,
  })
  registerTools(tools, handle, {
    detectScript: config.detectScript,
    oeX5Source: config.oeX5Source,
    oeSSource: config.oeSSource,
  })
}

// Declare hard dependencies so Cordis re-activates the plugin when the
// services become available (e.g. after a dynamic reload).
export const inject = ['skills', 'tools']

export { parseDetectOutput, runDeviceDetect } from './device-detect.js'
export { runOeSetup, OE_PACKS } from './oe-setup.js'
export { mountRdkSkills, PROVIDER_NAME } from './skill-provider.js'
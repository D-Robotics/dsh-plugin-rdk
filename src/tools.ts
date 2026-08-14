/**
 * Model-facing tools contributed by dsh-plugin-rdk:
 *  - `rdk_skills`: browse / search the indexed RDK skill catalog.
 *  - `rdk_board_detect`: detect whether the current host is an RDK board.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { runDeviceDetect } from './device-detect.js'
import type { RdkSkillsHandle } from './skill-provider.js'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** JSON round-trip mirrors the harness cloneJson semantics: plain data only, undefined fields dropped. */
const toJson = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue

export function registerTools(ctx: Context, handle: RdkSkillsHandle, detectScript?: string): void {
  ctx.tools.register(defineTool({
    name: 'rdk_skills',
    description:
      'Browse the local D-Robotics RDK skill catalog indexed by the dsh-plugin-rdk adapter (rdk-device-skills and rdk-skills packs). Call without a query to list every indexed skill; pass a keyword to search by name, description, or tag; pass an exact skill name (e.g. rdk-diagnostic) to get that skill detail with its file layout and scripts. Use when the user mentions RDK (地瓜机器人 / D-Robotics) boards, X3/X5/Ultra/S100/S600, BPU, HB DNN model deployment, TROS, or asks which RDK skills exist. Do not use it to modify skill files — read or edit them with the returned paths.',
    parameters: {
      query: {
        type: 'string',
        description: 'Optional exact skill name (returns that skill detail with scripts) or a keyword to search across skill names, descriptions, and tags.',
      },
      refresh: {
        type: 'boolean',
        description: 'Force a rescan of the configured skill directories instead of using the cached index.',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      await handle.scanAll(args.refresh === true)
      const raw = typeof args.query === 'string' ? args.query.trim() : ''
      if (raw === '') return toJson(await handle.summary())
      const detail = await handle.detail(raw)
      if (!('error' in detail)) return toJson(detail)
      const idx = await handle.scanAll(false)
      const q = raw.toLowerCase()
      const matches = idx.skills.filter((skill) => {
        const hay = `${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase()
        return hay.includes(q)
      })
      return toJson({
        query: raw,
        matched: matches.length,
        total: idx.skills.length,
        skills: matches.map((skill) => ({
          name: skill.name,
          description: skill.description,
          pack: skill.pack,
          ...(skill.version !== undefined ? { version: skill.version } : {}),
          ...(skill.tags.length > 0 ? { tags: skill.tags } : {}),
          dir: skill.dir,
        })),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'rdk_board_detect',
    description:
      'Detect whether the host running DeepSeek Harness is a D-Robotics RDK board, using the canonical detect_rdk.sh from the vendored rdk-diagnostic skill. Returns board / SoC / BPU architecture / memory / OS version fields, or { detected: false, reason } when the host is not an RDK board (or bash is unavailable). Use when the user asks which RDK board this is or whether this environment can run RDK device-side workflows. Read-only: it never changes board settings.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    },
    async execute() {
      return toJson(await runDeviceDetect(detectScript))
    },
  }))
}

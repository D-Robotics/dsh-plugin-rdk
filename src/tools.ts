/**
 * Model-facing tools contributed by dsh-plugin-rdk:
 *  - `rdk_skills`: browse / search the indexed RDK skill catalog.
 *  - `rdk_board_detect`: detect whether the current host is an RDK board.
 *  - `rdk_oe_setup`: run the official OE pack setup.sh into a project workspace.
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import { runDeviceDetect } from './device-detect.js'
import { runOeSetup } from './oe-setup.js'
import type { RdkSkillsHandle } from './skill-provider.js'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/**
 * Safe JSON serialization: wraps JSON.stringify in a try/catch so a single
 * non-serializable value (BigInt, circular reference, etc.) cannot crash the
 * entire tool-execution pipeline and take down every other tool in the harness.
 * Returns a structured error object on failure instead of throwing.
 */
const toJson = (value: unknown): JsonValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      error: 'toJson: failed to serialize tool result',
      reason: message,
      // Include a safe subset so the caller still has context.
      ...(typeof value === 'object' && value !== null
        ? { kind: (value as Record<string, unknown>).constructor?.name ?? typeof value }
        : {}),
    }
  }
}

const safeRender = (_args: unknown, value: unknown): { type: 'text'; text: string }[] => {
  try {
    return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  } catch {
    return [{ type: 'text' as const, text: `[unserializable result: ${typeof value}]` }]
  }
}
export interface ToolsRegistryView {
  register(definition: ToolDefinition): () => void
}

export interface OeSetupOptions {
  detectScript?: string
  oeX5Source?: string
  oeSSource?: string
}

export function registerTools(tools: ToolsRegistryView, handle: RdkSkillsHandle, opts?: OeSetupOptions): void {
  const detectScript = opts?.detectScript
  const oeX5Source = opts?.oeX5Source
  const oeSSource = opts?.oeSSource

  tools.register(defineTool({
    name: 'rdk_skills',
    description:
      'Browse the local D-Robotics RDK skill catalog indexed by the dsh-plugin-rdk adapter (rdk-device-skills, bsp-skills, oe-skills-x5, oe-skills-s, and rdk-skills hub packs). Call without a query to list every indexed skill; pass a keyword to search by name, description, or tag; pass an exact skill name (e.g. rdk-diagnostic) to get that skill detail with its file layout and scripts. Use when the user mentions RDK (地瓜机器人 / D-Robotics) boards, X3/X5/Ultra/S100/S600, BPU, HB DNN model deployment, TROS, or asks which RDK skills exist. Do not use it to modify skill files — read or edit them with the returned paths.',
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
      render: safeRender,
    },
    async execute(args) {
      try {
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
      } catch (error) {
        return toJson({
          error: 'rdk_skills: unexpected error',
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }))

  tools.register(defineTool({
    name: 'rdk_board_detect',
    description:
      'Detect whether the host running DeepSeek Harness is a D-Robotics RDK board, using the canonical detect_rdk.sh from the vendored rdk-diagnostic skill. Returns board / SoC / BPU architecture / memory / OS version fields, or { detected: false, reason } when the host is not an RDK board (or bash is unavailable). Use when the user asks which RDK board this is or whether this environment can run RDK device-side workflows. Read-only: it never changes board settings.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: safeRender,
    },
    async execute() {
      try {
        return toJson(await runDeviceDetect(detectScript))
      } catch (error) {
        return toJson({
          detected: false,
          error: 'rdk_board_detect: unexpected error',
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }))

  tools.register(defineTool({
    name: 'rdk_oe_setup',
    description:
      'Install a D-Robotics OpenExplorer (OE) toolchain pack into a project workspace — exactly like the official repos do. Clones (or uses the given local checkout of) the pack repository and runs its own setup.sh against the project root. For oe-skills-x5 this lays down .drobotics/ and injects the "X5 Workspace Rules" routing block into CLAUDE.md / AGENTS.md; for oe-skills-s it lays down .horizon/ with the Horizon routing rules. DeepSeek Harness reads the workspace CLAUDE.md, so the routing rules take effect for the agent. Only run this after the user confirms the target project root — setup.sh writes files into it.',
    parameters: {
      pack: {
        type: 'string',
        required: true,
        enum: ['oe-skills-x5', 'oe-skills-s'],
        description: 'Which OE pack to install.',
      },
      projectRoot: {
        type: 'string',
        required: true,
        description: 'Absolute path of the project workspace to initialize (setup.sh <projectRoot>).',
      },
      source: {
        type: 'string',
        description: 'Optional git URL or local checkout path of the pack repo; defaults to the official GitHub repository.',
      },
    },
    output: {
      schema: { type: 'json' },
      render: safeRender,
    },
    async execute(args) {
      try {
        return toJson(await runOeSetup({
          pack: args.pack,
          projectRoot: args.projectRoot,
          source: args.source ?? (args.pack === 'oe-skills-x5' ? oeX5Source : oeSSource),
        }))
      } catch (error) {
        return toJson({
          ok: false,
          error: 'rdk_oe_setup: unexpected error',
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }))
}
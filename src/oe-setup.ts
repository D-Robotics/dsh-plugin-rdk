/**
 * Workspace integration for the OpenExplorer (OE) packs.
 *
 * The OE packs are workspace-integrated: their official install flow is
 * `bash setup.sh <project-root>`, which lays the pack resources into the
 * project (`.drobotics/` for X5, `.horizon/` for S-series) and injects
 * routing rules into CLAUDE.md / AGENTS.md. This module runs that exact
 * flow — the same script from the same repository — so a DSH workspace ends
 * up identical to an install performed manually from the upstream repo.
 * DeepSeek Harness reads the workspace CLAUDE.md, so the injected routing
 * rules take effect for the agent.
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface OePackInfo {
  pack: 'oe-skills-x5' | 'oe-skills-s'
  repoUrl: string
  /** Directory setup.sh lays down inside the project root. */
  workspaceDir: string
}

export const OE_PACKS: Record<'oe-skills-x5' | 'oe-skills-s', OePackInfo> = {
  'oe-skills-x5': {
    pack: 'oe-skills-x5',
    repoUrl: 'https://github.com/D-Robotics/oe-skills-x5.git',
    workspaceDir: '.drobotics',
  },
  'oe-skills-s': {
    pack: 'oe-skills-s',
    repoUrl: 'https://github.com/D-Robotics/oe-skills-s.git',
    workspaceDir: '.horizon',
  },
}

export interface OeSetupInput {
  pack: string
  projectRoot: string
  source?: string
  timeoutMs?: number
}

export interface OeSetupResult {
  ok: boolean
  pack: string
  projectRoot: string
  source: string
  exitCode: number | null
  output: string[]
  reason?: string
  verified?: { workspaceDir: string; version?: string; skills: number }
}

interface ExecError extends Error {
  code?: unknown
  stdout?: string
  stderr?: string
}

const cacheRoot = (): string => join(tmpdir(), 'dsh-plugin-rdk')
const isGitUrl = (value: string): boolean => /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(value)

const runGit = (args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync('git', args, { cwd, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })

/** Resolve the pack repository: a local checkout is used as-is; a git URL is cached in the OS temp dir. */
async function acquireRepo(info: OePackInfo, source: string): Promise<{ dir: string; used: string }> {
  if (!isGitUrl(source)) {
    if (existsSync(join(source, 'setup.sh'))) return { dir: source, used: source }
    throw new Error(`source path has no setup.sh: ${source}`)
  }
  const dir = join(cacheRoot(), info.pack)
  if (existsSync(join(dir, '.git'))) {
    try {
      await runGit(['fetch', '--depth', '1', 'origin'], dir)
      await runGit(['reset', '--hard', 'FETCH_HEAD'], dir)
      return { dir, used: source }
    } catch {
      /* stale cache — fall through to a fresh clone */
    }
  }
  mkdirSync(cacheRoot(), { recursive: true })
  rmSync(dir, { recursive: true, force: true })
  await runGit(['clone', '--depth', '1', source, dir])
  return { dir, used: source }
}

function countSkills(workspaceRoot: string): number {
  const dir = join(workspaceRoot, 'skills')
  if (!existsSync(dir)) return 0
  let count = 0
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()!
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) stack.push(join(current, entry.name))
      else if (entry.isFile() && entry.name === 'SKILL.md') count += 1
    }
  }
  return count
}

/**
 * Run the pack's own setup.sh against a project root — the exact install
 * flow of the upstream repository — and verify the laid-down workspace.
 */
export async function runOeSetup(input: OeSetupInput): Promise<OeSetupResult> {
  const info = OE_PACKS[input.pack as keyof typeof OE_PACKS]
  if (info === undefined) {
    return {
      ok: false,
      pack: input.pack,
      projectRoot: input.projectRoot,
      source: input.source ?? '',
      exitCode: null,
      output: [],
      reason: `unknown pack "${input.pack}" — expected oe-skills-x5 or oe-skills-s`,
    }
  }

  const repoSource = input.source ?? info.repoUrl
  let repo
  try {
    repo = await acquireRepo(info, repoSource)
  } catch (error) {
    return {
      ok: false,
      pack: info.pack,
      projectRoot: input.projectRoot,
      source: repoSource,
      exitCode: null,
      output: [],
      reason: `failed to acquire pack repository: ${(error as Error).message}`,
    }
  }

  const setupScript = join(repo.dir, 'setup.sh')
  try {
    const { stdout, stderr } = await execFileAsync('bash', [setupScript, input.projectRoot], {
      timeout: input.timeoutMs ?? 300_000,
      maxBuffer: 8 * 1024 * 1024,
    })
    const output = [...stderr.split('\n'), ...stdout.split('\n')]
      .map((line) => line.trimEnd())
      .filter(Boolean)

    const workspaceRoot = join(input.projectRoot, info.workspaceDir)
    const verified: NonNullable<OeSetupResult['verified']> = {
      workspaceDir: info.workspaceDir,
      ...(existsSync(join(workspaceRoot, 'VERSION'))
        ? { version: readFileSync(join(workspaceRoot, 'VERSION'), 'utf8').trim() }
        : {}),
      skills: countSkills(workspaceRoot),
    }

    return {
      ok: true,
      pack: info.pack,
      projectRoot: input.projectRoot,
      source: repo.used,
      exitCode: 0,
      output: output.slice(-40),
      verified,
    }
  } catch (error) {
    const execError = error as ExecError
    const output = [
      ...(typeof execError.stderr === 'string' ? execError.stderr.split('\n') : []),
      ...(typeof execError.stdout === 'string' ? execError.stdout.split('\n') : []),
    ]
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .slice(-40)
    return {
      ok: false,
      pack: info.pack,
      projectRoot: input.projectRoot,
      source: repo.used,
      exitCode: typeof execError.code === 'number' ? execError.code : null,
      output,
      reason: execError.code === 'ENOENT' ? 'bash was not found on PATH; setup.sh requires bash' : (execError.message ?? 'setup.sh failed'),
    }
  }
}

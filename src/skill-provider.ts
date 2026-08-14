/**
 * The `rdk-skills` provider: registers every skill found in the configured
 * directories (vendored packs first, user `skillsDirs` on top) into the
 * harness-native `ctx.skills` registry so they appear in the session skill
 * catalog and load through the built-in `skill` tool.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSkillMarkdown } from './frontmatter.js'

export const PROVIDER_NAME = 'rdk-skills'
export const DEFAULT_RANK = 300

export interface IndexedSkill {
  name: string
  description: string
  whenToUse?: string
  version?: string
  tags: string[]
  pack: string
  dir: string
  path: string
}

export interface ScanRootStats {
  pack: string
  dir: string
  found: number
}

export interface ScanStats {
  roots: ScanRootStats[]
  errors: string[]
}

export interface RdkSkillIndex {
  skills: IndexedSkill[]
  byName: Map<string, IndexedSkill>
  stats: ScanStats
  scannedAt: string | null
}

export interface ProviderOptions {
  /** Extra skill directories scanned BEFORE the vendored packs (they win duplicates). */
  skillsDirs: string[]
  /** Include the OpenExplorer toolchain packs (oe-skills-x5 / oe-skills-s). */
  includeOe: boolean
  /** Override the vendored skills root (mainly for tests). */
  vendorDir?: string
}

export interface RdkSkillsHandle {
  scanAll(force: boolean): Promise<RdkSkillIndex>
  summary(): Promise<Record<string, unknown>>
  detail(name: string): Promise<Record<string, unknown>>
  listSkillFiles(dir: string): Promise<{ files: string[]; scripts: string[] }>
  dispose(): void
}

/** Minimal local view of the DSH skill-registry contract (keeps this package dependency-light). */
interface SkillProviderControl {
  signal: AbortSignal
  invalidate: () => void
}
interface SkillLookupOptions {
  cwd?: string
  signal?: AbortSignal
}
interface SkillResourceBase {
  kind: 'directory'
  path: string
}
interface SkillInvocation {
  modelInvocable: boolean
  userInvocable: boolean
}
interface SkillSummary {
  name: string
  description: string
  whenToUse?: string
  invocation: SkillInvocation
  source: string
  provider: string
  resourceBase?: SkillResourceBase
}
interface SkillCandidate extends SkillSummary {
  rank: number
  locator: unknown
  path?: string
  metadata?: Readonly<Record<string, unknown>>
}
interface SkillDefinition extends SkillSummary {
  content: string
  path?: string
  metadata?: Readonly<Record<string, unknown>>
}
interface SkillProvider {
  name: string
  list(options: SkillLookupOptions): Promise<readonly SkillCandidate[] | { candidates: readonly SkillCandidate[]; complete: boolean }>
  get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined>
}

/** The part of the DSH skills registry this plugin consumes. */
export interface SkillsRegistryView {
  registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void
}

export const defaultVendorDir = (): string => fileURLToPath(new URL('../skills', import.meta.url))

function stamp(): string {
  return new Date().toISOString()
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** Sorted names of the skill-pack directories directly under a root. */
async function listVendorPackNames(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

async function readTextAt(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

interface WalkBucket {
  skills: IndexedSkill[]
  byName: Map<string, IndexedSkill>
  errors: string[]
}

async function walk(dir: string, depth: number, pack: string, out: WalkBucket, skipDirs?: ReadonlySet<string>): Promise<void> {
  if (depth > 6) return
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    out.errors.push(`${dir}: ${(error as Error).message}`)
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    if (skipDirs !== undefined && skipDirs.has(entry.name)) continue
    const childDir = join(dir, entry.name)
    const mdPath = join(childDir, 'SKILL.md')
    const md = await readTextAt(mdPath)
    if (md !== undefined) {
      const parsed = parseSkillMarkdown(md)
      if (parsed !== undefined && !out.byName.has(parsed.name)) {
        const skill: IndexedSkill = { ...parsed, pack, dir: childDir, path: mdPath }
        out.byName.set(parsed.name, skill)
        out.skills.push(skill)
      }
    }
    await walk(childDir, depth + 1, pack, out, skipDirs)
  }
}

/** The OE packs are their own upstream repos; the hub merely mirrors them. */
const isOePack = (name: string): boolean => name === 'oe-skills-x5' || name === 'oe-skills-s'

async function scan(options: ProviderOptions, index: RdkSkillIndex): Promise<void> {
  const vendorDir = options.vendorDir ?? defaultVendorDir()
  const roots: { pack: string; dir: string; skipDirs?: Set<string> }[] = []

  options.skillsDirs.forEach((dir, i) => {
    roots.push({ pack: `external-${i + 1}`, dir })
  })

  // Every directory under the vendor root is a skill pack. Scan order decides
  // duplicate precedence: device pack first, then additional packs
  // (bsp-skills, ...), then the dedicated OE packs (gated by includeOe), and
  // the hub last so its mirrors of any pack lose to the dedicated source.
  const vendorPackNames = await listVendorPackNames(vendorDir)
  const device = vendorPackNames.filter((n) => n === 'rdk-device-skills')
  const hub = vendorPackNames.filter((n) => n === 'rdk-skills')
  const oe = vendorPackNames.filter(isOePack)
  const others = vendorPackNames.filter((n) => n !== 'rdk-device-skills' && n !== 'rdk-skills' && !isOePack(n))

  const oePresent = new Set(oe)
  const hubSkip = new Set<string>()
  if (!options.includeOe || oePresent.has('oe-skills-x5')) hubSkip.add('oe-skills-x5')
  if (!options.includeOe || oePresent.has('oe-skills-s')) hubSkip.add('oe-skills-s')

  for (const pack of [...device, ...others, ...(options.includeOe ? oe : []), ...hub]) {
    roots.push({
      pack,
      dir: join(vendorDir, pack),
      ...(pack === 'rdk-skills' && hubSkip.size > 0 ? { skipDirs: hubSkip } : {}),
    })
  }

  const stats: ScanRootStats[] = []
  for (const root of roots) {
    const local: WalkBucket = { skills: [], byName: new Map(), errors: [] }
    if (await isDirectory(root.dir)) {
      await walk(root.dir, 0, root.pack, local, root.skipDirs)
    } else {
      local.errors.push(`${root.dir}: directory not found`)
    }
    for (const skill of local.skills) {
      if (!index.byName.has(skill.name)) {
        index.byName.set(skill.name, skill)
        index.skills.push(skill)
      }
    }
    index.stats.errors.push(...local.errors)
    stats.push({ pack: root.pack, dir: root.dir, found: local.skills.length })
  }
  index.stats.roots = stats
  index.scannedAt = stamp()
}

function candidateOf(skill: IndexedSkill): SkillCandidate {
  return {
    name: skill.name,
    description: skill.description,
    ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'custom',
    provider: PROVIDER_NAME,
    rank: DEFAULT_RANK,
    locator: { path: skill.path, dir: skill.dir, pack: skill.pack },
    path: skill.path,
    metadata: {
      ...(skill.version !== undefined ? { version: skill.version } : {}),
      ...(skill.tags.length > 0 ? { tags: skill.tags } : {}),
      pack: skill.pack,
    },
  }
}

/**
 * Mount the skill provider + index for this plugin. Returns a handle the tool
 * layer uses, or `undefined` when the skills service is unavailable.
 */
export function mountRdkSkills(skills: SkillsRegistryView, options: ProviderOptions): RdkSkillsHandle {
  const index: RdkSkillIndex = { skills: [], byName: new Map(), stats: { roots: [], errors: [] }, scannedAt: null }
  let scanPromise: Promise<void> | null = null

  const scanAll = (force: boolean): Promise<RdkSkillIndex> => {
    if (force) {
      index.skills = []
      index.byName = new Map()
      index.stats = { roots: [], errors: [] }
      index.scannedAt = null
      scanPromise = null
    }
    if (index.scannedAt !== null) return Promise.resolve(index)
    if (scanPromise === null) {
      scanPromise = scan(options, index).finally(() => {
        scanPromise = null
      })
    }
    return scanPromise.then(() => index)
  }

  const dispose = skills.registerProvider((control) => ({
    name: PROVIDER_NAME,
    async list() {
      await scanAll(false)
      return index.skills.map(candidateOf)
    },
    async get(candidate) {
      const locator = candidate.locator as { path?: unknown; dir?: unknown; pack?: unknown } | undefined
      if (locator === undefined || typeof locator.path !== 'string') return undefined
      const raw = await readTextAt(locator.path)
      if (raw === undefined) return undefined
      const parsed = parseSkillMarkdown(raw)
      if (parsed === undefined) return undefined
      return {
        name: parsed.name,
        description: parsed.description,
        ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'custom',
        provider: PROVIDER_NAME,
        resourceBase: { kind: 'directory' as const, path: typeof locator.dir === 'string' ? locator.dir : dirname(locator.path) },
        path: locator.path,
        metadata: {
          ...(parsed.version !== undefined ? { version: parsed.version } : {}),
          ...(parsed.tags.length > 0 ? { tags: parsed.tags } : {}),
          pack: typeof locator.pack === 'string' ? locator.pack : 'rdk',
        },
        content: parsed.body,
      }
    },
  }))

  const pick = (skill: IndexedSkill): Record<string, unknown> => ({
    name: skill.name,
    description: skill.description,
    pack: skill.pack,
    ...(skill.version !== undefined ? { version: skill.version } : {}),
    ...(skill.tags.length > 0 ? { tags: skill.tags } : {}),
    dir: skill.dir,
  })

  const listSkillFiles = async (dir: string): Promise<{ files: string[]; scripts: string[] }> => {
    const result = { files: [] as string[], scripts: [] as string[] }
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && /\.(sh|py|md|json|ya?ml)$/i.test(entry.name)) result.files.push(entry.name)
      }
    } catch {
      /* skill dir may be gone */
    }
    try {
      const entries = await readdir(join(dir, 'scripts'), { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) result.scripts.push(`scripts/${entry.name}`)
      }
    } catch {
      /* no scripts dir */
    }
    return result
  }

  return {
    scanAll,
    dispose,
    listSkillFiles,
    async summary() {
      const idx = await scanAll(false)
      return {
        provider: PROVIDER_NAME,
        scannedAt: idx.scannedAt,
        count: idx.skills.length,
        roots: idx.stats.roots,
        errors: idx.stats.errors.slice(0, 20),
        skills: idx.skills.map(pick),
      }
    },
    async detail(name) {
      const idx = await scanAll(false)
      const skill = idx.byName.get(name)
      if (skill === undefined) return { error: `unknown skill: ${name}` }
      const files = await listSkillFiles(skill.dir)
      return {
        ...pick(skill),
        path: skill.path,
        files: files.files,
        scripts: files.scripts,
        ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
      }
    },
  }
}

#!/usr/bin/env node
/**
 * Sync the vendored skill packs under ./skills from the upstream repositories.
 *
 * Sources, in priority order:
 *   1. <PACK>_SOURCE env var — a git URL to clone (also accepts a local path).
 *   2. A local checkout path passed via --local <pack>=<path> or <PACK>_LOCAL env.
 *   3. The default GitHub URL (https://github.com/D-Robotics/<pack>.git).
 *
 * Env vars:
 *   RDK_DEVICE_SKILLS_SOURCE / RDK_DEVICE_SKILLS_LOCAL
 *   RDK_SKILLS_SOURCE        / RDK_SKILLS_LOCAL
 *   BSP_SKILLS_SOURCE        / BSP_SKILLS_LOCAL
 *   OE_X5_SKILLS_SOURCE      / OE_X5_SKILLS_LOCAL
 *   OE_S_SKILLS_SOURCE       / OE_S_SKILLS_LOCAL
 *
 * The hub pack (`rdk-skills`) is the catalog hub: only its hub-native content
 * (d-robotics-pack-installer + README + license files) is vendored. Mirrors
 * of the other packs live in their dedicated vendored directories, so copying
 * them again under the hub would only duplicate content and inflate the scan.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const vendorDir = join(repoRoot, 'skills')
const tmpDir = join(repoRoot, '.sync-tmp')

const SOURCES = [
  {
    pack: 'rdk-device-skills',
    env: 'RDK_DEVICE_SKILLS_SOURCE',
    localEnv: 'RDK_DEVICE_SKILLS_LOCAL',
    url: 'https://github.com/D-Robotics/rdk-device-skills.git',
  },
  {
    pack: 'rdk-skills',
    env: 'RDK_SKILLS_SOURCE',
    localEnv: 'RDK_SKILLS_LOCAL',
    url: 'https://github.com/D-Robotics/rdk-skills.git',
  },
  {
    pack: 'bsp-skills',
    env: 'BSP_SKILLS_SOURCE',
    localEnv: 'BSP_SKILLS_LOCAL',
    url: 'https://github.com/D-Robotics/bsp-skills.git',
  },
  {
    pack: 'oe-skills-x5',
    env: 'OE_X5_SKILLS_SOURCE',
    localEnv: 'OE_X5_SKILLS_LOCAL',
    url: 'https://github.com/D-Robotics/oe-skills-x5.git',
    skillsPath: 'x5/skills',
  },
  {
    pack: 'oe-skills-s',
    env: 'OE_S_SKILLS_SOURCE',
    localEnv: 'OE_S_SKILLS_LOCAL',
    url: 'https://github.com/D-Robotics/oe-skills-s.git',
    skillsPath: 'horizon/skills',
  },
]

const HUB_NATIVE_TOP_LEVEL = ['d-robotics-pack-installer']

const isGitUrl = (value) => /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(value)

function gitClone(url, dest) {
  rmSync(dest, { recursive: true, force: true })
  execFileSync('git', ['clone', '--depth', '1', url, dest], { stdio: 'inherit' })
}

function gitHead(path) {
  try {
    return execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return undefined
  }
}

/** Copy one source tree's skills directory (or a filtered hub view) into the vendor dir. */
function copySkillsFrom(sourcePath, source) {
  const dest = join(vendorDir, source.pack)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  const skillsRel = source.skillsPath ?? 'skills'
  const skillsDir = join(sourcePath, skillsRel)
  if (!existsSync(skillsDir)) throw new Error(`${sourcePath} has no ${skillsRel} directory`)
  cpSync(skillsDir, dest, {
    recursive: true,
    filter: (src) => {
      const name = src.split(/[\\/]/).pop() ?? ''
      return !name.startsWith('.') && name !== 'node_modules'
    },
  })

  // Preserve the upstream license files for attribution.
  for (const entry of readdirSync(sourcePath)) {
    if (/^license/i.test(entry)) {
      cpSync(join(sourcePath, entry), join(dest, entry))
    }
  }

  // The hub pack only keeps its native skill: mirrors of the other packs are
  // vendored from their dedicated repositories and would be pure duplicates.
  if (source.pack === 'rdk-skills') {
    const destEntries = readdirSync(dest, { withFileTypes: true })
    for (const entry of destEntries) {
      const isFile = entry.isFile()
      const isReadme = isFile && /^readme\./i.test(entry.name)
      const isLicense = isFile && /^license/i.test(entry.name)
      const isHubNative = entry.isDirectory() && HUB_NATIVE_TOP_LEVEL.includes(entry.name)
      if (!(isReadme || isLicense || isHubNative)) {
        rmSync(join(dest, entry.name), { recursive: true, force: true })
      }
    }
  }
  return dest
}

function resolveSource(source, localOverrides) {
  const explicit = process.env[source.env] || process.env[source.localEnv]
  if (explicit !== undefined && explicit !== '') {
    if (isGitUrl(explicit)) {
      const dest = join(tmpDir, source.pack)
      gitClone(explicit, dest)
      return { path: dest, label: explicit, commit: gitHead(dest) }
    }
    if (existsSync(explicit)) return { path: explicit, label: explicit, commit: gitHead(explicit) }
    throw new Error(`${source.env} points to a path that does not exist: ${explicit}`)
  }
  const localOverride = localOverrides?.[source.pack]
  if (localOverride !== undefined && existsSync(localOverride)) {
    return { path: localOverride, label: localOverride, commit: gitHead(localOverride) }
  }
  const dest = join(tmpDir, source.pack)
  gitClone(source.url, dest)
  return { path: dest, label: source.url, commit: gitHead(dest) }
}

function main() {
  const localOverrides = {}
  const args = process.argv.slice(2)
  for (const arg of args) {
    const match = /^--local\s+([^=]+)=(.+)$/.exec(arg)
    if (match !== null) localOverrides[match[1]] = match[2]
  }

  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(vendorDir, { recursive: true })
  const manifest = { generatedAt: new Date().toISOString(), packs: [] }

  for (const source of SOURCES) {
    console.log(`[sync] ${source.pack} ...`)
    const resolved = resolveSource(source, localOverrides)
    const dest = copySkillsFrom(resolved.path, source)
    const skillCount = readdirSync(dest).length
    manifest.packs.push({
      pack: source.pack,
      source: resolved.label,
      ...(resolved.commit !== undefined ? { commit: resolved.commit } : {}),
      topLevelEntries: skillCount,
    })
    console.log(`[sync] ${source.pack} -> ${dest} (${skillCount} entries, ${resolved.commit ?? 'no git commit'})`)
  }

  writeFileSync(join(vendorDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  rmSync(tmpDir, { recursive: true, force: true })
  console.log('[sync] done. Vendored skills updated under ./skills')
}

main()

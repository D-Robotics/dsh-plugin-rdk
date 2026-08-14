#!/usr/bin/env node
/**
 * Sync the vendored skill packs under ./skills from the upstream repositories.
 *
 * Sources, in priority order:
 *   1. <PACK>_SOURCE env var — a local path or a git URL to clone.
 *   2. <PACK>_LOCAL env var — a local checkout path.
 *   3. A bundled local fallback (D:/20_Dev_Projects/RDK-Skills/<pack>).
 *   4. The default GitHub URL (https://github.com/D-Robotics/<pack>.git).
 *
 * Env vars:
 *   RDK_DEVICE_SKILLS_SOURCE / RDK_DEVICE_SKILLS_LOCAL
 *   RDK_SKILLS_SOURCE        / RDK_SKILLS_LOCAL
 *   BSP_SKILLS_SOURCE        / BSP_SKILLS_LOCAL
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
    localFallback: 'D:/20_Dev_Projects/RDK-Skills/rdk-device-skills',
  },
  {
    pack: 'rdk-skills',
    env: 'RDK_SKILLS_SOURCE',
    localEnv: 'RDK_SKILLS_LOCAL',
    url: 'https://github.com/D-Robotics/rdk-skills.git',
    localFallback: 'D:/20_Dev_Projects/RDK-Skills/rdk-skills',
  },
  {
    pack: 'bsp-skills',
    env: 'BSP_SKILLS_SOURCE',
    localEnv: 'BSP_SKILLS_LOCAL',
    url: 'https://github.com/D-Robotics/bsp-skills.git',
    localFallback: 'D:/20_Dev_Projects/RDK-Skills/bsp-skills',
  },
]

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

function copySkillsFrom(sourcePath, pack) {
  const dest = join(vendorDir, pack)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  const skillsDir = join(sourcePath, 'skills')
  if (!existsSync(skillsDir)) throw new Error(`${sourcePath} has no skills/ directory`)
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
  return dest
}

function resolveSource(source) {
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
  if (existsSync(source.localFallback)) {
    return { path: source.localFallback, label: source.localFallback, commit: gitHead(source.localFallback) }
  }
  const dest = join(tmpDir, source.pack)
  gitClone(source.url, dest)
  return { path: dest, label: source.url, commit: gitHead(dest) }
}

function main() {
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(vendorDir, { recursive: true })
  const manifest = { generatedAt: new Date().toISOString(), packs: [] }

  for (const source of SOURCES) {
    console.log(`[sync] ${source.pack} ...`)
    const resolved = resolveSource(source)
    const dest = copySkillsFrom(resolved.path, source.pack)
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

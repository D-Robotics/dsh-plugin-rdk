/**
 * SKILL.md frontmatter parsing for the vendored D-Robotics RDK skill packs.
 *
 * The packs follow the Agent Skills convention: a leading `---` YAML block
 * carrying `name`, `description`, optional `whenToUse`, `version` and a
 * `metadata` object (with `tags` etc.), followed by the Markdown body.
 *
 * Some upstream files are written in "loose" YAML (e.g. unquoted `: ` inside
 * a description). We parse strictly first and fall back to a tolerant
 * field-by-field extraction so no skill is silently dropped.
 */
import { parse } from 'yaml'

export interface ParsedSkill {
  name: string
  description: string
  whenToUse?: string
  version?: string
  tags: string[]
  body: string
}

/** Kebab-case skill-name grammar shared by the DSH skill registry. */
export function isSkillName(name: unknown): name is string {
  return typeof name === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
}

const unquote = (value: string): string => {
  let v = value
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  return v
}

/** Tolerant single-line field extraction for non-strict-YAML frontmatter. */
function extractField(lines: string[], key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.*?)\\s*$`)
  for (const line of lines) {
    const match = line.match(re)
    if (match === null) continue
    const value = unquote(match[1])
    return value === '' ? undefined : value
  }
  return undefined
}

/** Tolerant `- item` list extraction (used for metadata.tags). */
function extractList(lines: string[], key: string): string[] {
  const items: string[] = []
  let active = false
  for (const line of lines) {
    if (/^\s*$/.test(line)) continue
    const kv = line.match(/^\s*([\w.-]+):\s*(.*)$/)
    const item = line.match(/^\s+-\s+(.+?)\s*$/)
    if (kv !== null) {
      active = kv[1] === key && kv[2] === ''
    } else if (active && item !== null) {
      const value = unquote(item[1])
      if (value !== '') items.push(value)
    }
  }
  return items
}

export function parseSkillMarkdown(raw: string): ParsedSkill | undefined {
  const lines = raw.split(/\r?\n/)
  if (lines[0] !== '---') return undefined
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '...') {
      end = i
      break
    }
  }
  if (end < 0) return undefined

  const headLines = lines.slice(1, end)
  const body = lines.slice(end + 1).join('\n').trim()

  let record: Record<string, unknown> | undefined
  try {
    const data = parse(headLines.join('\n'))
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      record = data as Record<string, unknown>
    }
  } catch {
    record = undefined
  }

  if (record === undefined) {
    // Lenient fallback for "loose" YAML frontmatter.
    const name = extractField(headLines, 'name')
    const description = extractField(headLines, 'description')
    if (!isSkillName(name) || description === undefined || description === '') return undefined
    return {
      name,
      description,
      whenToUse: extractField(headLines, 'whenToUse'),
      version: extractField(headLines, 'version'),
      tags: extractList(headLines, 'tags'),
      body,
    }
  }

  const { name, description } = record
  if (!isSkillName(name) || typeof description !== 'string' || description === '') return undefined

  const whenToUse = typeof record.whenToUse === 'string' && record.whenToUse !== '' ? record.whenToUse : undefined
  const version = typeof record.version === 'string' && record.version !== '' ? record.version : undefined

  const metadata = record.metadata
  let tags: string[] = []
  if (metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const tagsField = (metadata as Record<string, unknown>).tags
    if (Array.isArray(tagsField)) {
      tags = tagsField.filter((tag): tag is string => typeof tag === 'string')
    }
  }

  return {
    name,
    description,
    whenToUse,
    version,
    tags,
    body,
  }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { isSkillName, parseSkillMarkdown } from '../frontmatter.js'

test('parses a valid SKILL.md frontmatter', () => {
  const md = [
    '---',
    'name: rdk-diagnostic',
    'description: Read-only health snapshot for RDK boards.',
    'version: 0.1.0',
    'metadata:',
    '  tags:',
    '    - rdk',
    '    - diagnostic',
    '---',
    '# Body',
    '',
    'Some instructions.',
    '',
  ].join('\n')
  const parsed = parseSkillMarkdown(md)
  assert.ok(parsed)
  assert.equal(parsed.name, 'rdk-diagnostic')
  assert.equal(parsed.description, 'Read-only health snapshot for RDK boards.')
  assert.equal(parsed.version, '0.1.0')
  assert.deepEqual(parsed.tags, ['rdk', 'diagnostic'])
  assert.equal(parsed.body, '# Body\n\nSome instructions.')
})

test('handles optional whenToUse and missing metadata', () => {
  const md = ['---', 'name: plain-skill', 'description: Just a skill.', 'whenToUse: when needed', '---', 'body'].join('\n')
  const parsed = parseSkillMarkdown(md)
  assert.ok(parsed)
  assert.equal(parsed.whenToUse, 'when needed')
  assert.equal(parsed.version, undefined)
  assert.deepEqual(parsed.tags, [])
})

test('rejects missing, malformed or invalid frontmatter', () => {
  assert.equal(parseSkillMarkdown('no frontmatter'), undefined)
  assert.equal(parseSkillMarkdown('---\ndescription: x\n---\nbody'), undefined) // missing name
  assert.equal(parseSkillMarkdown('---\nname: Bad Name\ndescription: x\n---\nbody'), undefined) // invalid name
  assert.equal(parseSkillMarkdown('---\nname: ok\ndescription: ""\n---\nbody'), undefined) // empty description
  assert.equal(parseSkillMarkdown('---\nname: ok\ndescription: x\n'), undefined) // no closing fence
  assert.equal(parseSkillMarkdown('---\nname: ok\ndescription: x\n---\n')?.body, '') // empty body is allowed
})

test('falls back to lenient parsing for loose YAML (unquoted ": " in description)', () => {
  const md = [
    '---',
    'name: rdk-hardware',
    'description: Facts about boards: pins, TOPS/RAM differences, and CAN. Use WHENEVER a question is about hardware.',
    'version: 1.0.0',
    'metadata:',
    '  tags:',
    '    - rdk',
    '    - hardware',
    '---',
    '# Hardware',
  ].join('\n')
  const parsed = parseSkillMarkdown(md)
  assert.ok(parsed)
  assert.equal(parsed.name, 'rdk-hardware')
  assert.ok(parsed.description.includes('Use WHENEVER'))
  assert.deepEqual(parsed.tags, ['rdk', 'hardware'])
  assert.equal(parsed.body, '# Hardware')
})

test('validates kebab-case skill names', () => {
  assert.equal(isSkillName('rdk-diagnostic'), true)
  assert.equal(isSkillName('x5-ptq-compile'), true)
  assert.equal(isSkillName('j6-ucp-hbm-infer'), true)
  assert.equal(isSkillName('Bad'), false)
  assert.equal(isSkillName('under_score'), false)
  assert.equal(isSkillName('dash-'), false)
  assert.equal(isSkillName(''), false)
})

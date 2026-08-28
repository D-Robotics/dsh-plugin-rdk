import test from 'node:test'
import assert from 'node:assert/strict'
import { sshMirror } from '../oe-setup.js'

test('sshMirror rewrites https github URLs to ssh form', () => {
  assert.equal(
    sshMirror('https://github.com/D-Robotics/oe-skills-x5.git'),
    'git@github.com:D-Robotics/oe-skills-x5.git',
  )
  assert.equal(
    sshMirror('https://github.com/D-Robotics/oe-skills-x5'),
    'git@github.com:D-Robotics/oe-skills-x5.git',
  )
})

test('sshMirror leaves non-github and non-https URLs untouched', () => {
  assert.equal(sshMirror('git@github.com:D-Robotics/oe-skills-x5.git'), undefined)
  assert.equal(sshMirror('https://example.com/repo.git'), undefined)
  assert.equal(sshMirror('https://github.com/D-Robotics/oe-skills-x5/tree/main'), undefined)
  assert.equal(sshMirror('/local/path/checkout'), undefined)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDetectOutput } from '../device-detect.js'

test('parses detect_rdk.sh KEY=value output', () => {
  const output = [
    'RDK_BOARD=rdk-x5',
    'RDK_SOC=sunrise-5',
    'RDK_BPU_ARCH=bayes-e',
    'RDK_MEM_GB=4',
    'RDK_OS_VERSION=3.0.0',
    'RDK_PRODUCT_MODEL=d-robotics rdk x5 v1.0',
  ].join('\n')
  const parsed = parseDetectOutput(output)
  assert.equal(parsed.board, 'rdk-x5')
  assert.equal(parsed.soc, 'sunrise-5')
  assert.equal(parsed.bpuArch, 'bayes-e')
  assert.equal(parsed.memGb, 4)
  assert.equal(parsed.osVersion, '3.0.0')
  assert.equal(parsed.productModel, 'd-robotics rdk x5 v1.0')
})

test('ignores unknown fields and non-numeric memory', () => {
  const parsed = parseDetectOutput('RDK_BOARD=rdk-s100\nRANDOM_OTHER=thing\nRDK_MEM_GB=abc\n')
  assert.equal(parsed.board, 'rdk-s100')
  assert.equal(parsed.memGb, undefined)
})

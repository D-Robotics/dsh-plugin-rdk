/**
 * Lightweight RDK board detection: runs the canonical `detect_rdk.sh` from the
 * vendored rdk-diagnostic skill via bash and parses its `KEY=value` output.
 * Exit code 2 means "not an RDK host" — reported as `detected: false` with the
 * script's stderr message as the reason. No data is fabricated on failures.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

export const defaultDetectScript = (): string =>
  fileURLToPath(new URL('../skills/rdk-device-skills/rdk-diagnostic/scripts/detect_rdk.sh', import.meta.url))

export interface DetectResult {
  detected: boolean
  code: number | null
  reason?: string
  board?: string
  soc?: string
  bpuArch?: string
  memGb?: number
  osVersion?: string
  productModel?: string
  script: string
}

interface ExecError extends Error {
  code?: unknown
  stdout?: string
  stderr?: string
}

/** Parse the `KEY=value` lines printed by detect_rdk.sh. Exported for tests. */
export function parseDetectOutput(output: string): Omit<DetectResult, 'detected' | 'code' | 'reason' | 'script'> {
  const fields: Omit<DetectResult, 'detected' | 'code' | 'reason' | 'script'> = {}
  for (const line of output.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match === null) continue
    const key = match[1]
    const value = match[2]
    switch (key) {
      case 'RDK_BOARD':
        fields.board = value
        break
      case 'RDK_SOC':
        fields.soc = value
        break
      case 'RDK_BPU_ARCH':
        fields.bpuArch = value
        break
      case 'RDK_MEM_GB': {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) fields.memGb = parsed
        break
      }
      case 'RDK_OS_VERSION':
        fields.osVersion = value
        break
      case 'RDK_PRODUCT_MODEL':
        fields.productModel = value
        break
    }
  }
  return fields
}

export async function runDeviceDetect(customScript?: string, timeoutMs = 30_000): Promise<DetectResult> {
  const script = customScript ?? defaultDetectScript()
  const result: DetectResult = { detected: false, code: null, script }

  try {
    const { stdout } = await execFileAsync('bash', [script], { timeout: timeoutMs, maxBuffer: 1024 * 1024 })
    Object.assign(result, parseDetectOutput(stdout))
    result.code = 0
    result.detected = result.board !== undefined && result.board !== 'unknown'
    return result
  } catch (error) {
    const execError = error as ExecError
    if (typeof execError.code === 'number') {
      result.code = execError.code
      const stderr = typeof execError.stderr === 'string' ? execError.stderr : ''
      const message = stderr
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(' ')
      result.reason = message === '' ? `detect script exited with code ${execError.code}` : message
      return result
    }
    if (execError.code === 'ENOENT') {
      result.reason = 'bash was not found on PATH; the RDK detector script requires bash'
    } else {
      result.reason = execError.message
    }
    return result
  }
}

/**
 * 容器运行器 — IPC 版本
 *
 * 与 Step 05 的区别：
 *   - 传入 IPC_DIR 环境变量给容器
 *   - 容器可以通过 IPC 目录与宿主机通信
 */

import { spawn } from 'node:child_process'
import path from 'node:path'

const OUTPUT_START = '---NANOCLAW_OUTPUT_START---'
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---'
const CONTAINER_TIMEOUT = 30_000

export interface ContainerInput {
  prompt: string
  sessionId: string | null
  groupFolder: string
}

export interface ContainerResult {
  output: string
  sessionId: string
}

export interface RunOptions {
  input: ContainerInput
  ipcDir: string // IPC 目录路径
  onOutput: (chunk: string) => void
}

export function runContainerAgent(options: RunOptions): Promise<ContainerResult> {
  const { input, ipcDir, onOutput } = options

  return new Promise((resolve, reject) => {
    const agentPath = path.join(import.meta.dirname, 'mock-agent.ts')
    const child = spawn('npx', ['tsx', agentPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, IPC_DIR: ipcDir },
    })

    let fullOutput = ''
    let capturing = false
    let buffer = ''

    let timer = setTimeout(() => child.kill(), CONTAINER_TIMEOUT)
    function resetTimeout(): void {
      clearTimeout(timer)
      timer = setTimeout(() => child.kill(), CONTAINER_TIMEOUT)
    }

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.includes(OUTPUT_START)) { capturing = true; continue }
        if (line.includes(OUTPUT_END)) { capturing = false; continue }
        if (capturing) {
          fullOutput += line + '\n'
          onOutput(line)
          resetTimeout()
        }
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      console.error(`  [agent-log] ${chunk.toString().trim()}`)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && code !== null) {
        reject(new Error(`容器退出码 ${code}`))
        return
      }
      resolve({
        output: fullOutput.trim(),
        sessionId: input.sessionId ?? crypto.randomUUID(),
      })
    })

    child.stdin.write(JSON.stringify(input))
    child.stdin.end()
  })
}

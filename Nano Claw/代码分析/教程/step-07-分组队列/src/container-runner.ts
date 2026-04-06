/**
 * 容器运行器 — 流式输出版本
 *
 * 与 Step 04 的区别：
 *   - stdout 逐行解析，实时触发 onOutput 回调
 *   - 哨兵标记状态机
 *   - 活动超时（收到输出时重置）
 */

import { spawn } from 'node:child_process'
import path from 'node:path'

const OUTPUT_START = '---NANOCLAW_OUTPUT_START---'
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---'
const CONTAINER_TIMEOUT = 30_000 // 30 秒（教程用短超时）

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
  onOutput: (chunk: string) => void // 流式输出回调
}

export function runContainerAgent(options: RunOptions): Promise<ContainerResult> {
  const { input, onOutput } = options

  return new Promise((resolve, reject) => {
    const agentPath = path.join(import.meta.dirname, 'mock-agent.ts')
    const child = spawn('npx', ['tsx', agentPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let fullOutput = ''
    let capturing = false
    let buffer = '' // 行缓冲

    // 活动超时：收到输出时重置
    let timer = setTimeout(() => {
      console.error('[超时] 容器无响应，强制停止')
      child.kill()
    }, CONTAINER_TIMEOUT)

    function resetTimeout(): void {
      clearTimeout(timer)
      timer = setTimeout(() => {
        console.error('[超时] 容器无活动，强制停止')
        child.kill()
      }, CONTAINER_TIMEOUT)
    }

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()

      // 逐行处理（处理不完整行的情况）
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // 最后一个可能不完整，留到下次

      for (const line of lines) {
        if (line.includes(OUTPUT_START)) {
          capturing = true
          continue
        }
        if (line.includes(OUTPUT_END)) {
          capturing = false
          continue
        }
        if (capturing) {
          fullOutput += line + '\n'
          onOutput(line)
          resetTimeout() // 收到输出，重置超时
        }
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      // Agent 的日志输出到 stderr
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

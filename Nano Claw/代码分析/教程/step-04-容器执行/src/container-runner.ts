/**
 * 容器运行器 — 启动子进程执行 Agent
 *
 * 对应 NanoClaw 原版 src/container-runner.ts。
 * 原版用 docker run 启动容器，这里用子进程模拟。
 * 核心协议完全一致：
 *   - stdin: JSON { prompt, sessionId, groupFolder }
 *   - stdout: 哨兵标记包裹的 Agent 响应
 */

import { spawn } from 'node:child_process'
import path from 'node:path'

const OUTPUT_START = '---NANOCLAW_OUTPUT_START---'
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---'

export interface ContainerInput {
  prompt: string
  sessionId: string | null
  groupFolder: string
}

export interface ContainerResult {
  output: string
  sessionId: string
}

/**
 * 运行容器 Agent
 *
 * NanoClaw 原版流程：
 *   1. buildVolumeMounts() — 构建挂载（本步骤省略）
 *   2. buildContainerArgs() — 构建 docker 命令
 *   3. spawn 容器进程
 *   4. stdin 写入 JSON
 *   5. stdout 流式读取，解析哨兵标记
 *   6. 超时管理（本步骤省略）
 */
export function runContainerAgent(input: ContainerInput): Promise<ContainerResult> {
  return new Promise((resolve, reject) => {
    // 原版: docker run -i --rm nanoclaw-agent:latest
    // 教程: tsx mock-agent.ts
    const agentPath = path.join(import.meta.dirname, 'mock-agent.ts')
    const child = spawn('npx', ['tsx', agentPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      // 流式输出：实时打印（NanoClaw 原版在这里调用 onOutput 回调）
      process.stdout.write(`  [容器] ${text}`)
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`容器退出码 ${code}: ${stderr}`))
        return
      }

      // 解析哨兵标记，提取 Agent 响应
      const output = extractOutput(stdout)
      if (!output) {
        reject(new Error('未找到 Agent 输出标记'))
        return
      }

      resolve({
        output,
        sessionId: input.sessionId ?? crypto.randomUUID(),
      })
    })

    // 通过 stdin 发送输入
    child.stdin.write(JSON.stringify(input))
    child.stdin.end()
  })
}

/**
 * 从 stdout 中提取哨兵标记之间的内容
 */
function extractOutput(stdout: string): string | null {
  const startIdx = stdout.indexOf(OUTPUT_START)
  const endIdx = stdout.indexOf(OUTPUT_END)
  if (startIdx === -1 || endIdx === -1) return null
  return stdout.slice(startIdx + OUTPUT_START.length, endIdx).trim()
}

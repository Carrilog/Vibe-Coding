/**
 * IPC 监听器 — 宿主机端
 *
 * 对应 NanoClaw 原版 src/ipc.ts 的 startIpcWatcher()。
 * 每 1 秒扫描 IPC 目录，处理容器发来的消息和任务操作。
 */

import fs from 'node:fs'
import path from 'node:path'

const IPC_POLL_INTERVAL = 1000

export interface IpcCallbacks {
  onMessage: (msg: { chatJid: string; content: string }) => void
  onTaskOp: (op: { operation: string; [key: string]: unknown }) => void
}

export function startIpcWatcher(ipcDir: string, callbacks: IpcCallbacks): void {
  const messagesDir = path.join(ipcDir, 'messages')
  const tasksDir = path.join(ipcDir, 'tasks')
  const errorsDir = path.join(ipcDir, 'errors')

  // 确保目录存在
  for (const dir of [messagesDir, tasksDir, errorsDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }

  console.log(`IPC 监听启动: ${ipcDir}`)

  setInterval(() => {
    // 扫描消息目录
    scanDirectory(messagesDir, errorsDir, (data) => {
      callbacks.onMessage(data as { chatJid: string; content: string })
    })

    // 扫描任务目录
    scanDirectory(tasksDir, errorsDir, (data) => {
      callbacks.onTaskOp(data as { operation: string })
    })
  }, IPC_POLL_INTERVAL)
}

function scanDirectory(
  dir: string,
  errorsDir: string,
  handler: (data: unknown) => void,
): void {
  let files: string[]
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return
  }

  for (const file of files) {
    const filePath = path.join(dir, file)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      handler(data)
      fs.unlinkSync(filePath) // 处理成功，删除文件
    } catch (err) {
      // 处理失败，移到 errors/ 目录
      console.error(`[IPC] 处理失败: ${file}`, err)
      const errorPath = path.join(errorsDir, file)
      try {
        fs.renameSync(filePath, errorPath)
      } catch {
        // 移动也失败了，直接删除
        fs.unlinkSync(filePath)
      }
    }
  }
}

/**
 * 向容器发送追加消息（入站 IPC）
 */
export function sendIpcInput(ipcDir: string, content: string): void {
  const inputDir = path.join(ipcDir, 'input')
  fs.mkdirSync(inputDir, { recursive: true })
  const filePath = path.join(inputDir, `${crypto.randomUUID()}.json`)
  fs.writeFileSync(filePath, JSON.stringify({ content }))
}

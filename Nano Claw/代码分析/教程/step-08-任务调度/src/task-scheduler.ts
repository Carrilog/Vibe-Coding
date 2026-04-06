/**
 * 任务调度器
 *
 * 对应 NanoClaw 原版 src/task-scheduler.ts。
 * 每 10 秒检查到期任务（原版 60 秒），执行后更新 next_run。
 */

import { getDueTasks, updateTaskNextRun, deleteTask, logTaskRun } from './db.js'
import { runContainerAgent } from './container-runner.js'
import type { ScheduledTask } from './types.js'

const SCHEDULER_INTERVAL = 10_000 // 10 秒（教程用短间隔）

export function startSchedulerLoop(): void {
  console.log(`任务调度器启动，检查间隔 ${SCHEDULER_INTERVAL / 1000}s`)

  setInterval(async () => {
    const dueTasks = getDueTasks()
    if (dueTasks.length === 0) return

    console.log(`\n[调度器] 发现 ${dueTasks.length} 个到期任务`)

    for (const task of dueTasks) {
      await executeTask(task)
    }
  }, SCHEDULER_INTERVAL)
}

async function executeTask(task: ScheduledTask): Promise<void> {
  const startedAt = new Date().toISOString()
  console.log(`[调度器] 执行任务 "${task.prompt}" (${task.scheduleType}: ${task.scheduleValue})`)

  try {
    const result = await runContainerAgent({
      input: {
        prompt: `[定时任务] ${task.prompt}`,
        sessionId: null,
        groupFolder: task.groupFolder,
      },
      onOutput: (chunk) => {
        console.log(`  [任务] >> ${chunk}`)
      },
    })

    logTaskRun(task.id, startedAt, 'success', result.output)

    // 计算下次执行时间
    const nextRun = computeNextRun(task)
    if (nextRun) {
      updateTaskNextRun(task.id, nextRun)
      console.log(`[调度器] 下次执行: ${nextRun}`)
    } else {
      // once 类型，执行后删除
      deleteTask(task.id)
      console.log(`[调度器] 一次性任务已完成并删除`)
    }
  } catch (err) {
    logTaskRun(task.id, startedAt, 'error', undefined, String(err))
    console.error(`[调度器] 任务执行失败:`, err)
  }
}

function computeNextRun(task: ScheduledTask): string | null {
  switch (task.scheduleType) {
    case 'interval': {
      const ms = parseInt(task.scheduleValue)
      return new Date(Date.now() + ms).toISOString()
    }
    case 'once':
      return null // 执行后删除
    case 'cron':
      // 简化：cron 解析需要 cron-parser 库，这里用固定间隔模拟
      return new Date(Date.now() + 60_000).toISOString()
    default:
      return null
  }
}

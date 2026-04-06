/**
 * 分组队列 — 并发控制
 *
 * 对应 NanoClaw 原版 src/group-queue.ts。
 * 管理每个分组的容器执行队列，控制全局并发数。
 */

const MAX_CONCURRENT = 3
const RETRY_BASE_MS = 5000
const MAX_RETRIES = 5

interface GroupState {
  active: boolean
  idleWaiting: boolean
  pending: Array<() => void>
  retryCount: number
}

export class GroupQueue {
  private groups = new Map<string, GroupState>()
  private activeCount = 0

  private getOrCreate(folder: string): GroupState {
    let state = this.groups.get(folder)
    if (!state) {
      state = { active: false, idleWaiting: false, pending: [], retryCount: 0 }
      this.groups.set(folder, state)
    }
    return state
  }

  /**
   * 入队消息处理
   * - 容器空闲等待中 → 通过 onIdle 回调复用
   * - 有空闲槽位 → 直接执行
   * - 无槽位 → 排队
   */
  enqueue(folder: string, callback: () => void, onIdle?: () => void): void {
    const state = this.getOrCreate(folder)

    if (state.idleWaiting && onIdle) {
      // 容器空闲等待中，通过 IPC 发送新消息
      console.log(`[队列] ${folder}: 复用空闲容器`)
      onIdle()
      return
    }

    if (state.active) {
      // 容器正在处理，排队
      console.log(`[队列] ${folder}: 排队等待 (队列长度: ${state.pending.length + 1})`)
      state.pending.push(callback)
      return
    }

    if (this.activeCount < MAX_CONCURRENT) {
      // 有空闲槽位，直接启动
      this.activate(folder, callback)
    } else {
      // 无槽位，排队
      console.log(`[队列] ${folder}: 等待槽位 (活跃: ${this.activeCount}/${MAX_CONCURRENT})`)
      state.pending.push(callback)
    }
  }

  private activate(folder: string, callback: () => void): void {
    const state = this.getOrCreate(folder)
    state.active = true
    state.idleWaiting = false
    this.activeCount++
    console.log(`[队列] ${folder}: 启动容器 (活跃: ${this.activeCount}/${MAX_CONCURRENT})`)
    callback()
  }

  /** 标记容器进入空闲等待 */
  notifyIdle(folder: string): void {
    const state = this.getOrCreate(folder)
    state.idleWaiting = true
    console.log(`[队列] ${folder}: 容器进入空闲等待`)
  }

  /** 容器完成，释放槽位 */
  release(folder: string): void {
    const state = this.getOrCreate(folder)
    state.active = false
    state.idleWaiting = false
    state.retryCount = 0
    this.activeCount--
    console.log(`[队列] ${folder}: 释放槽位 (活跃: ${this.activeCount}/${MAX_CONCURRENT})`)
    this.drainNext()
  }

  /** 容器失败，指数退避重试 */
  retryLater(folder: string, callback: () => void): void {
    const state = this.getOrCreate(folder)
    state.active = false
    this.activeCount--

    if (state.retryCount >= MAX_RETRIES) {
      console.error(`[队列] ${folder}: 达到最大重试次数，放弃`)
      state.retryCount = 0
      this.drainNext()
      return
    }

    state.retryCount++
    const delay = RETRY_BASE_MS * Math.pow(2, state.retryCount - 1)
    console.log(`[队列] ${folder}: ${delay}ms 后重试 (第 ${state.retryCount} 次)`)
    setTimeout(() => this.enqueue(folder, callback), delay)
  }

  /** 处理下一个排队的分组 */
  private drainNext(): void {
    for (const [folder, state] of this.groups) {
      if (state.pending.length > 0 && !state.active) {
        const next = state.pending.shift()!
        this.activate(folder, next)
        return
      }
    }
  }

  getStatus(): Record<string, string> {
    const status: Record<string, string> = {}
    for (const [folder, state] of this.groups) {
      if (state.active) status[folder] = state.idleWaiting ? 'IDLE_WAITING' : 'ACTIVE'
      else if (state.pending.length > 0) status[folder] = `QUEUED(${state.pending.length})`
      else status[folder] = 'IDLE'
    }
    return status
  }
}

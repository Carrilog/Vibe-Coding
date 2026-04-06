/**
 * Channel 注册表 — 渠道工厂模式
 *
 * 对应 NanoClaw 原版 src/channels/registry.ts。
 */

import type { Channel } from '../types.js'

export type ChannelFactory = {
  create(): Channel
}

const factories = new Map<string, ChannelFactory>()

export function registerChannel(name: string, factory: ChannelFactory): void {
  factories.set(name, factory)
  console.log(`[Channel] 注册渠道: ${name}`)
}

export function getChannelFactory(name: string): ChannelFactory | undefined {
  return factories.get(name)
}

export function getRegisteredChannelNames(): string[] {
  return [...factories.keys()]
}

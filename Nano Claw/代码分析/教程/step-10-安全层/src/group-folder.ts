/**
 * 分组目录路径验证
 *
 * 对应 NanoClaw 原版 src/group-folder.ts。
 * 防止路径穿越攻击。
 */

import path from 'node:path'

const VALID_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/
const RESERVED_NAMES = new Set(['global'])

/** 验证分组目录名是否合法 */
export function isValidGroupFolder(name: string): boolean {
  if (!name || !VALID_NAME_PATTERN.test(name)) return false
  if (RESERVED_NAMES.has(name)) return false
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false
  return true
}

/** 验证并抛出异常 */
export function assertValidGroupFolder(name: string): void {
  if (!isValidGroupFolder(name)) {
    throw new Error(`非法的分组目录名: "${name}"`)
  }
}

/** 解析为绝对路径，检查是否在 groupsDir 内 */
export function resolveGroupFolderPath(groupsDir: string, folder: string): string {
  assertValidGroupFolder(folder)
  const resolved = path.resolve(groupsDir, folder)
  // 防止路径穿越：解析后必须在 groupsDir 内
  if (!resolved.startsWith(path.resolve(groupsDir) + path.sep)) {
    throw new Error(`路径穿越检测: "${folder}" 解析到 groupsDir 外部`)
  }
  return resolved
}

/**
 * 挂载安全验证
 *
 * 对应 NanoClaw 原版 src/mount-security.ts。
 * 验证容器额外挂载是否安全。
 */

import path from 'node:path'
import fs from 'node:fs'

export interface MountAllowlist {
  allowedRoots: Array<{ hostPath: string; readWrite: boolean }>
  blockedPatterns: string[]
  nonMainReadOnly: boolean
}

const DEFAULT_BLOCKED_PATTERNS = [
  '.ssh', '.gnupg', '.aws', '.azure', '.kube', '.docker',
  'credentials', '.env', '.netrc', '.npmrc', '.pypirc',
  'id_rsa', 'id_ed25519', 'private_key', '.secret',
]

/** 验证单个挂载请求 */
export function validateMount(
  mount: { hostPath: string; containerPath: string; readWrite: boolean },
  allowlist: MountAllowlist,
  isMain: boolean,
): { valid: boolean; reason: string } {
  const { hostPath, containerPath, readWrite } = mount

  // 1. 检查 blockedPatterns
  const patterns = allowlist.blockedPatterns.length > 0
    ? allowlist.blockedPatterns
    : DEFAULT_BLOCKED_PATTERNS
  for (const pattern of patterns) {
    if (hostPath.includes(pattern)) {
      return { valid: false, reason: `匹配 blockedPattern: "${pattern}"` }
    }
  }

  // 2. 检查是否在 allowedRoots 内
  const resolvedHost = fs.existsSync(hostPath) ? fs.realpathSync(hostPath) : hostPath
  const inAllowedRoot = allowlist.allowedRoots.some((root) => {
    const resolvedRoot = fs.existsSync(root.hostPath) ? fs.realpathSync(root.hostPath) : root.hostPath
    return resolvedHost.startsWith(resolvedRoot)
  })
  if (!inAllowedRoot) {
    return { valid: false, reason: `不在 allowedRoots 内: "${hostPath}"` }
  }

  // 3. 检查容器路径合法性
  if (containerPath.includes('..') || path.isAbsolute(containerPath) || containerPath.includes(':')) {
    return { valid: false, reason: `非法容器路径: "${containerPath}"` }
  }

  // 4. 非 main 分组强制只读
  if (!isMain && allowlist.nonMainReadOnly && readWrite) {
    return { valid: false, reason: '非 main 分组不允许读写挂载 (nonMainReadOnly=true)' }
  }

  // 5. 检查 readWrite 权限
  const matchedRoot = allowlist.allowedRoots.find((root) => resolvedHost.startsWith(root.hostPath))
  if (readWrite && matchedRoot && !matchedRoot.readWrite) {
    return { valid: false, reason: `allowedRoot 不允许读写: "${matchedRoot.hostPath}"` }
  }

  return { valid: true, reason: 'OK' }
}

/** 生成示例 allowlist 模板 */
export function generateAllowlistTemplate(): MountAllowlist {
  return {
    allowedRoots: [
      { hostPath: '/Users/me/projects', readWrite: true },
      { hostPath: '/Users/me/data', readWrite: false },
    ],
    blockedPatterns: DEFAULT_BLOCKED_PATTERNS,
    nonMainReadOnly: true,
  }
}

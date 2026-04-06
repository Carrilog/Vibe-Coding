/**
 * Step 10 入口 — 安全层演示
 *
 * 演示三个安全模块的工作方式：
 *   1. 发送者白名单
 *   2. 路径验证
 *   3. 挂载安全
 */

import { loadSenderAllowlist, isTriggerAllowed, shouldDropMessage } from './sender-allowlist.js'
import { isValidGroupFolder, resolveGroupFolderPath } from './group-folder.js'
import { validateMount, generateAllowlistTemplate } from './mount-security.js'

console.log('=== NanoClaw Step 10: 安全层 ===\n')

// ── 1. 发送者白名单 ──
console.log('--- 1. 发送者白名单 ---\n')

loadSenderAllowlist({
  default: { allow: '*', mode: 'trigger' },
  chats: {
    'trusted@g.us': {
      allow: ['alice@s.whatsapp.net', 'bob@s.whatsapp.net'],
      mode: 'trigger',
    },
    'spam@g.us': {
      allow: [],
      mode: 'drop',
    },
  },
  logDenied: true,
})

// 默认群组：所有人可触发
console.log('默认群组 - Alice:', isTriggerAllowed('default@g.us', 'alice@s.whatsapp.net'))

// 受信群组：只有白名单用户可触发
console.log('受信群组 - Alice:', isTriggerAllowed('trusted@g.us', 'alice@s.whatsapp.net'))
console.log('受信群组 - Eve:', isTriggerAllowed('trusted@g.us', 'eve@s.whatsapp.net'))

// 垃圾群组：所有消息丢弃
console.log('垃圾群组 - 丢弃?', shouldDropMessage('spam@g.us', 'anyone@s.whatsapp.net'))

// ── 2. 路径验证 ──
console.log('\n--- 2. 路径验证 ---\n')

const testFolders = ['main', 'dev-team', 'my_group', '../etc', 'global', 'a/b', '']
for (const folder of testFolders) {
  console.log(`  "${folder}" → ${isValidGroupFolder(folder) ? '✓ 合法' : '✗ 非法'}`)
}

// 路径穿越检测
const groupsDir = '/tmp/nanoclaw-demo/groups'
try {
  resolveGroupFolderPath(groupsDir, 'main')
  console.log('\n  resolveGroupFolderPath("main") → ✓ 通过')
} catch (e) {
  console.log(`\n  resolveGroupFolderPath("main") → ✗ ${e}`)
}

// ── 3. 挂载安全 ──
console.log('\n--- 3. 挂载安全 ---\n')

const allowlist = generateAllowlistTemplate()
console.log('Allowlist 模板:', JSON.stringify(allowlist, null, 2))

const testMounts = [
  { hostPath: '/Users/me/projects/app', containerPath: 'app', readWrite: true },
  { hostPath: '/Users/me/.ssh', containerPath: 'ssh', readWrite: false },
  { hostPath: '/Users/me/projects/app', containerPath: '../escape', readWrite: false },
  { hostPath: '/Users/me/data/files', containerPath: 'files', readWrite: true },
]

console.log('\n挂载验证 (isMain=true):')
for (const mount of testMounts) {
  const result = validateMount(mount, allowlist, true)
  console.log(`  ${mount.hostPath} → ${result.valid ? '✓' : '✗'} ${result.reason}`)
}

console.log('\n挂载验证 (isMain=false, nonMainReadOnly=true):')
const rwMount = { hostPath: '/Users/me/projects/app', containerPath: 'app', readWrite: true }
const result = validateMount(rwMount, allowlist, false)
console.log(`  ${rwMount.hostPath} (rw) → ${result.valid ? '✓' : '✗'} ${result.reason}`)

console.log('\n=== 安全层演示完成 ===')

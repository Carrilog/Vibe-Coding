/**
 * Mock Agent — 模拟容器内的 Agent Runner
 *
 * 对应 NanoClaw 原版 container/agent-runner/src/index.ts。
 * 原版流程：
 *   1. 从 stdin 读取 JSON
 *   2. 构建 MessageStream
 *   3. 调用 Claude Agent SDK query()
 *   4. 输出结果（带哨兵标记）
 *
 * 这里模拟步骤 1 和 4，用固定回复替代 Claude API 调用。
 */

const OUTPUT_START = '---NANOCLAW_OUTPUT_START---'
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---'

async function main(): Promise<void> {
  // 从 stdin 读取 JSON 输入
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  const input = JSON.parse(Buffer.concat(chunks).toString())

  // 模拟 Agent 处理（真实场景调用 Claude Agent SDK）
  console.error('[mock-agent] 收到 prompt，正在处理...')

  // 模拟处理延迟
  await new Promise((r) => setTimeout(r, 500))

  // 从 prompt 中提取用户消息，生成简单回复
  const reply = generateReply(input.prompt)

  // 输出结果（带哨兵标记）
  // NanoClaw 原版也是这个格式
  console.log(OUTPUT_START)
  console.log(reply)
  console.log(OUTPUT_END)
}

function generateReply(prompt: string): string {
  if (prompt.includes('你好')) return '你好！我是 Andy，有什么可以帮你的吗？'
  if (prompt.includes('天气')) return '让我帮你查一下天气信息...'
  if (prompt.includes('日程')) return '好的，我来看看你的日程安排。'
  return '收到你的消息，让我想想...'
}

main().catch(console.error)

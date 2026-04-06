/**
 * Mock Agent — 分段输出版本
 *
 * 模拟 Agent 的流式输出：每隔一段时间输出一行。
 */

const OUTPUT_START = '---NANOCLAW_OUTPUT_START---'
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  const input = JSON.parse(Buffer.concat(chunks).toString())

  console.error('[mock-agent] 收到 prompt，开始流式处理...')

  // 生成分段回复
  const lines = generateReply(input.prompt)

  console.log(OUTPUT_START)
  for (const line of lines) {
    await sleep(300) // 模拟 Agent 思考延迟
    console.log(line)
  }
  console.log(OUTPUT_END)
}

function generateReply(prompt: string): string[] {
  if (prompt.includes('你好')) {
    return ['你好！我是 Andy。', '很高兴认识你！', '有什么可以帮你的吗？']
  }
  if (prompt.includes('天气')) {
    return ['让我查一下天气...', '今天晴，气温 22°C。', '适合出门散步！']
  }
  return ['收到你的消息。', '让我想想...', '好的，我来处理。']
}

main().catch(console.error)

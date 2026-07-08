const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; [key: string]: unknown }>
}

interface ClaudeOptions {
  system: string
  messages: ClaudeMessage[]
  model?: string
  maxTokens?: number
}

export async function callClaude(options: ClaudeOptions): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model || 'claude-sonnet-4-6',
      max_tokens: options.maxTokens || 4096,
      system: options.system,
      messages: options.messages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((b: any) => b.type === 'text')
  if (!textBlock?.text) {
    const types = data.content?.map((b: any) => b.type).join(', ') || 'none'
    throw new Error(`Claude returned no text. Content types: ${types}. Stop: ${data?.stop_reason || 'unknown'}`)
  }
  return textBlock.text
}

export function parseJsonResponse<T>(text: string): T {
  if (!text) throw new Error('Empty response from Claude')
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  // Tolerate prose around the JSON — extract from first bracket to last
  const start = cleaned.search(/[{[]/)
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1)
  return JSON.parse(cleaned) as T
}

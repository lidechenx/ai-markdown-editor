import {
  AI_ERROR_BODY_PREVIEW_CHARS,
  AI_POLISH_TEMPERATURE,
  DEFAULT_AI_MODEL,
} from '../constants/defaults'

const CHAT_COMPLETIONS_PATH = '/chat/completions'

export type AiPolishParams = {
  baseUrl: string
  apiKey: string
  model: string
  /** 用户选中的 Markdown 片段 */
  selection: string
}

export type AiPolishResult =
  | { ok: true; content: string }
  | { ok: false; message: string }

/**
 * 调用 OpenAI 兼容接口，对选中文本做「更易读」润色，返回模型输出正文。
 */
export async function polishMarkdownSelection(params: AiPolishParams): Promise<AiPolishResult> {
  const base = params.baseUrl.replace(/\/+$/, '')
  const url = `${base}${CHAT_COMPLETIONS_PATH}`

  if (!params.apiKey.trim()) {
    return { ok: false, message: '请先在侧栏填写 API Key。' }
  }
  if (!params.selection.trim()) {
    return { ok: false, message: '请先在编辑器中选中一段文字。' }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: params.model.trim() || DEFAULT_AI_MODEL,
        temperature: AI_POLISH_TEMPERATURE,
        messages: [
          {
            role: 'system',
            content:
              '你是中文写作助手。用户给你一段 Markdown。请在不改变语义的前提下，让语句更清晰、更适合新手阅读。只输出改写后的 Markdown 正文，不要加解释、不要用代码围栏包裹全文。',
          },
          { role: 'user', content: params.selection },
        ],
      }),
    })

    const raw = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        message: `接口错误 ${res.status}：${raw.slice(0, AI_ERROR_BODY_PREVIEW_CHARS)}`,
      }
    }

    let data: unknown
    try {
      data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] }
    } catch {
      return { ok: false, message: '响应不是合法 JSON。' }
    }

    const content = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
      ?.content
    if (!content?.trim()) {
      return { ok: false, message: '模型未返回有效内容。' }
    }

    return { ok: true, content: content.trim() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `请求失败：${msg}` }
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url, title, category, goals } = await req.json()

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY missing', debug: 'missing_key' }, { status: 500 })
    }

    const prompt = `You are a learning assistant. Break this course into modules.

Course: "${title || url}"
Category: ${category || 'General'}
URL: ${url || 'not provided'}
Goals: ${goals?.join(', ') || 'general learning'}

Reply ONLY with a JSON array, no markdown, no explanation:
[{"title": "Module name", "url": "${url || '#'}", "duration_mins": 10}]

Generate 3 to 6 modules.`

    const body = {
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.3,
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://project-focus.vercel.app',
        'X-Title': 'Project Focus',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // Return everything so we can see the exact error
    if (!response.ok) {
      return NextResponse.json({
        error: `OpenRouter API error`,
        http_status: response.status,
        openrouter_error: data?.error,
        openrouter_message: data?.error?.message,
        openrouter_code: data?.error?.code,
        full_response: data,
      }, { status: 500 })
    }

    const text = data.choices?.[0]?.message?.content || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Bad AI format', raw_text: text }, { status: 500 })
    }

    const modules = JSON.parse(jsonMatch[0])
    return NextResponse.json({ modules })

  } catch (err: any) {
    return NextResponse.json({ error: err.message, type: 'exception' }, { status: 500 })
  }
}

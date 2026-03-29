import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url, title, category } = await req.json()

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY missing', debug: 'missing_key' }, { status: 500 })
    }

    const courseRef = title || url || 'this course'

    // Try models in order until one works
    const models = [
      'meta-llama/llama-3.2-3b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-3-4b-it:free',
      'microsoft/phi-3-mini-128k-instruct:free',
    ]

    const prompt = `Break "${courseRef}" into 4 learning modules. Reply with ONLY a JSON array like this:
[
  {"title": "Module 1 name", "url": "${url || '#'}", "duration_mins": 15},
  {"title": "Module 2 name", "url": "${url || '#'}", "duration_mins": 20}
]
No explanation. JSON only.`

    let lastError = null

    for (const model of models) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://project-focus.vercel.app',
            'X-Title': 'Project Focus',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 400,
            temperature: 0.1,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          lastError = { model, status: response.status, error: data?.error?.message }
          continue // try next model
        }

        const text = data.choices?.[0]?.message?.content || ''
        const jsonMatch = text.match(/\[[\s\S]*?\]/)

        if (!jsonMatch) {
          lastError = { model, error: 'No JSON array in response', raw: text }
          continue
        }

        const modules = JSON.parse(jsonMatch[0])

        if (!Array.isArray(modules) || modules.length === 0) {
          lastError = { model, error: 'Empty modules array' }
          continue
        }

        // Success — return which model worked too
        return NextResponse.json({ modules, model_used: model })

      } catch (err: any) {
        lastError = { model, error: err.message }
        continue
      }
    }

    // All models failed
    return NextResponse.json({
      error: 'All models failed',
      last_error: lastError,
    }, { status: 500 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

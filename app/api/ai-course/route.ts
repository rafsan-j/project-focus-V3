import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url, title, category, goals } = await req.json()

  if (!url && !title) {
    return NextResponse.json({ error: 'URL or title required' }, { status: 400 })
  }

  const isYouTube = url && (url.includes('youtube.com') || url.includes('youtu.be'))
  const isFacebook = url && url.includes('facebook.com')

  let contextHint = ''
  if (isYouTube) contextHint = 'This is a YouTube video or playlist.'
  else if (isFacebook) contextHint = 'This is a Facebook video or group post.'
  else if (url) contextHint = `This is a link to: ${url}`

  const prompt = `You are a learning assistant helping a student break a course into modules.

Course title: "${title || url}"
Category: ${category || 'General'}
${contextHint}
User goals: ${goals?.join(', ') || 'general learning'}

Generate a practical module breakdown for this course. For each module:
- Give it a clear, specific title
- Provide the direct URL (use the source URL for all modules if it is a single video, or construct logical sub-URLs for playlists)
- Estimate duration in minutes

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {"title": "Module title", "url": "https://...", "duration_mins": 15},
  ...
]

Generate between 3 and 8 modules. Be practical and specific.`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://project-focus.vercel.app',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || '[]'

    const clean = text.replace(/```json|```/g, '').trim()
    const modules = JSON.parse(clean)

    return NextResponse.json({ modules })
  } catch (err) {
    return NextResponse.json({ error: 'AI failed, please add modules manually' }, { status: 500 })
  }
}

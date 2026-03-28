import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Create an initial response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update request cookies so subsequent Server Components can see them
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          
          // Re-initialize the response with the updated request headers
          // This ensures refreshed sessions are passed to your Pages/Layouts
          response = NextResponse.next({
            request,
          })

          // Update response cookies so the browser saves them
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. IMPORTANT: Use getUser() instead of getSession()
  // This is the secure check for Next.js 15 and triggers token refresh
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = path === '/login' || path.startsWith('/auth') || path === '/sw.js' || path.startsWith('/_next')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)'],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()           { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path       = request.nextUrl.pathname
  const isLogin    = path === '/login'
  const PROTECTED  = ['/dashboard', '/fazendas', '/talhoes', '/defensivos',
                       '/estoque', '/compras', '/aplicacoes', '/movimentacoes',
                       '/relatorios', '/importar', '/exportar', '/usuarios']
  const isDash     = path === '/' || PROTECTED.some(p => path === p || path.startsWith(p + '/'))

  if (!user && isDash)  return NextResponse.redirect(new URL('/login', request.url))
  if (user  && isLogin) return NextResponse.redirect(new URL('/dashboard', request.url))

  if (user && isDash) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'field')
      return NextResponse.redirect(new URL('/login?erro=acesso_negado', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}

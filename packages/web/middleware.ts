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
                       '/relatorios', '/importar', '/exportar', '/usuarios', '/perfil', '/inventario']
  const isDash     = path === '/' || PROTECTED.some(p => path === p || path.startsWith(p + '/'))

  // Perfil (papel + ativo) do usuário logado
  let profile: { role: string; ativo: boolean } | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('role, ativo').eq('id', user.id).single()
    profile = data
  }
  const inativo = !!user && profile?.ativo === false

  if (!user && isDash)                 return NextResponse.redirect(new URL('/login', request.url))
  // Usuário desativado: bloqueia tudo e manda pro login (sem laço)
  if (inativo && !isLogin)             return NextResponse.redirect(new URL('/login?desativado=1', request.url))
  if (user && !inativo && isLogin)     return NextResponse.redirect(new URL('/dashboard', request.url))

  if (user && !inativo && isDash) {
    if (profile?.role === 'field') {
      const FIELD_ALLOWED = ['/dashboard', '/aplicacoes', '/movimentacoes', '/estoque', '/perfil']
      const allowed = FIELD_ALLOWED.some(p => path === p || path.startsWith(p + '/'))
      if (!allowed)
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}

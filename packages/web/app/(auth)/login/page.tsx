'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Leaf, AlertCircle, Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const router       = useRouter()
  const params       = useSearchParams()
  const supabase     = createClient()

  const [email,    setEmail]    = useState('')
  const [senha,    setSenha]    = useState('')
  const [mostrar,  setMostrar]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState<string | null>(
    params.get('erro') === 'acesso_negado' ? 'Acesso negado para esse perfil no painel web.' : null
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-green-800">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <Leaf className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">HtoGestão</h1>
          <p className="text-green-300 mt-1 text-sm">Sistema de Gestão Agrícola</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Entrar no sistema</h2>

          {erro && (
            <div className="flex items-center gap-2 mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <Input
                  type={mostrar ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrar(!mostrar)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  {mostrar ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400">
            Problemas de acesso? Fale com o administrador.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

import { useState } from 'react'
import { useSession } from '@/contexts/SessionContext'

export function LoginPage() {
  const { login, isAuthLoading, authError } = useSession()
  const [credential, setCredential] = useState('')

  return (
    <article className="page-card max-w-md">
      <h1 className="text-xl font-semibold">Acceso</h1>
      <p className="mt-2 text-sm text-slate-600">
        Introduce la credencial de acceso. Si tienes problemas de conexión, revisa la red y que la
        aplicación esté publicada; los detalles técnicos aparecen en la consola del navegador.
      </p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void login(credential)
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Credencial
          <input
            className="rounded border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500"
            name="credential"
            autoComplete="username"
            value={credential}
            onChange={(ev) => {
              setCredential(ev.target.value)
            }}
            disabled={isAuthLoading}
          />
        </label>

        {authError ? (
          <div className="rounded-md border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-800" role="alert">
            <p>{authError}</p>
            {authError.includes('No se pudo conectar') ? (
              <p className="mt-2 text-xs text-red-700/90">
                Comprueba la red y que la aplicación esté disponible; revisa la consola para el detalle del
                fallo de conexión.
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          disabled={isAuthLoading}
        >
          {isAuthLoading ? 'Validando…' : 'Entrar'}
        </button>
      </form>
    </article>
  )
}

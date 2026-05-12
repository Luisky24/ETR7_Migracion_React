import { Link } from 'react-router-dom'
import { useSession } from '@/contexts/SessionContext'
import { ROUTES } from '@/router/routes'

export function HomePage() {
  const { lifecycle, isSessionReady } = useSession()

  return (
    <article className="page-card max-w-xl">
      <h1 className="text-xl font-semibold text-slate-900">Inicio</h1>
      <p className="mt-3 text-slate-700">
        SPA independiente (Vite + React + TypeScript). La sesión se restaura al recargar la pestaña
        mediante almacenamiento de sesión controlado.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Estado de sesión:{' '}
        <span className="font-medium text-slate-800">
          {!isSessionReady ? 'inicializando…' : lifecycle}
        </span>
      </p>
      <p className="mt-6 flex flex-wrap gap-3">
        <Link
          to={ROUTES.login}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Ir al acceso
        </Link>
        {lifecycle === 'authenticated' ? (
          <Link
            to={ROUTES.menu}
            className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Abrir menú
          </Link>
        ) : null}
      </p>
    </article>
  )
}

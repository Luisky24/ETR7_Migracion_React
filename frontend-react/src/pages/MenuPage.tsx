import { Link } from 'react-router-dom'
import { hasCapability, type CapabilityKey } from '@/contracts/capabilities.contract'
import { useSession } from '@/contexts/SessionContext'
import { ROUTES } from '@/router/routes'

interface MenuEntry {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly capability: CapabilityKey
  /** Ruta interna cuando el módulo exista; sin ruta = módulo planificado. */
  readonly to?: string
}

const MENU_ENTRIES: readonly MenuEntry[] = [
  {
    id: 'hub',
    title: 'Resumen',
    description: 'Vista general de la sesión y accesos rápidos.',
    capability: 'canAccessMenu',
    to: ROUTES.menu,
  },
  {
    id: 'calendar',
    title: 'Calendario',
    description: 'Encuentros del campeonato (solo lectura).',
    capability: 'canAccessCalendar',
    to: ROUTES.calendar,
  },
  {
    id: 'team',
    title: 'Equipo',
    description: 'Gestión de plantilla y permisos de equipo.',
    capability: 'canManageTeam',
  },
]

export function MenuPage() {
  const { state, logout } = useSession()

  if (state.status !== 'authenticated') {
    return null
  }

  const { user } = state
  const caps = user.capabilities

  return (
    <article className="page-card max-w-3xl">
      <header className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Menú principal</h1>
          <p className="mt-1 text-sm text-slate-600">
            Accesos según tu perfil. Las secciones sin permiso no se muestran.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">{user.displayName}</span>
          <span className="mx-1 text-slate-300">·</span>
          <span className="capitalize">{user.role}</span>
        </p>
      </header>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_ENTRIES.filter((entry) => hasCapability(caps, entry.capability)).map((entry) => (
          <li key={entry.id}>
            {entry.to ? (
              <Link
                to={entry.to}
                className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
              >
                <MenuCardBody entry={entry} />
              </Link>
            ) : (
              <div className="flex h-full flex-col rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4">
                <MenuCardBody entry={entry} planned />
              </div>
            )}
          </li>
        ))}
      </ul>

      <footer className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
        <Link
          to={ROUTES.home}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Volver al inicio
        </Link>
        <button
          type="button"
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          onClick={() => {
            logout()
          }}
        >
          Cerrar sesión
        </button>
      </footer>
    </article>
  )
}

function MenuCardBody({ entry, planned = false }: { entry: MenuEntry; planned?: boolean }) {
  return (
    <>
      <span className="text-base font-semibold text-slate-900">{entry.title}</span>
      <span className="mt-2 flex-1 text-sm text-slate-600">{entry.description}</span>
      {planned ? (
        <span className="mt-3 inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          Próximamente
        </span>
      ) : (
        <span className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Entrar</span>
      )}
    </>
  )
}

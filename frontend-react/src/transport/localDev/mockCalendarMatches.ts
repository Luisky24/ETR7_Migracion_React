import type { GasCalendarGetMatchesV2Response } from '@/features/calendar/contracts/calendar.contract'

/** Encuentros de muestra para calendario y enlace a Acta React en localhost. */
export function mockCalendarGetMatchesV2Response(
  categoriaTexto: unknown,
  faseTexto: unknown,
): GasCalendarGetMatchesV2Response {
  const cat = typeof categoriaTexto === 'string' ? categoriaTexto : 'Masculina'
  const fase = typeof faseTexto === 'string' ? faseTexto : 'Fase1'
  const suffix = cat === 'Femenina' ? 'F' : 'M'

  return {
    version: 2,
    matches: [
      {
        idEncuentro: `A|LOCAL ${suffix}|VISIT ${suffix}`,
        grupo: 'A',
        equipoLocal: `LOCAL ${suffix}`,
        equipoVisitante: `VISIT ${suffix}`,
        hora: '12:00',
        campo: 'Campo QA local',
        resultado: '0 - 0',
        estadoAlineaciones: 'Completa',
        estadoPartido: 'acta_abierta',
        referenciaEncuentro: fase === 'Fase2' ? `REF-${suffix}-001` : '',
      },
      {
        idEncuentro: `B|CLUB ${suffix} A|CLUB ${suffix} B`,
        grupo: 'B',
        equipoLocal: `CLUB ${suffix} A`,
        equipoVisitante: `CLUB ${suffix} B`,
        hora: '14:30',
        campo: 'Campo 2',
        resultado: '14 - 7',
        estadoAlineaciones: 'Completa',
        estadoPartido: 'acta_cerrada',
        referenciaEncuentro: '',
      },
      {
        idEncuentro: `C|ALPHA ${suffix}|BETA ${suffix}`,
        grupo: 'C',
        equipoLocal: `ALPHA ${suffix}`,
        equipoVisitante: `BETA ${suffix}`,
        hora: '—',
        campo: '—',
        resultado: '',
        estadoAlineaciones: 'Pendiente',
        estadoPartido: 'sin_alineacion',
        referenciaEncuentro: '',
      },
    ],
  }
}

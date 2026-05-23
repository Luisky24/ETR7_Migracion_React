/** Puntos por ensayo (try). */
export const POINTS_PER_TRY = 5
/** Puntos por transformación. */
export const POINTS_PER_CONVERSION = 2
/** Puntos por punto de castigo (penalty kick). */
export const POINTS_PER_PENALTY_KICK = 3

/** Puntos clasificación: victoria / empate / derrota (Fase I y II SPA). */
export const CLASSIFICATION_WIN = 3
export const CLASSIFICATION_DRAW = 2
export const CLASSIFICATION_LOSS = 0

/** Bonus defensivo: margen de derrota mínimo (debe haber ganador). */
export const DEFENSIVE_BONUS_DIFF_MIN = 1
/**
 * Límite exclusivo superior del margen (legacy GAS: `dif < 8`).
 * Equivale a diferencias 1…7 inclusive.
 */
export const DEFENSIVE_BONUS_DIFF_EXCLUSIVE_LIMIT = 8
/** @deprecated Usar DEFENSIVE_BONUS_DIFF_EXCLUSIVE_LIMIT con comparación `<`. */
export const DEFENSIVE_BONUS_DIFF_MAX = DEFENSIVE_BONUS_DIFF_EXCLUSIVE_LIMIT - 1

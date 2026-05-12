# Arquitectura base (ETR7 → React)

## Objetivo

Establecer una **estructura oficial y desacoplada** para la **migración progresiva** de ETR7 hacia un frontend **React moderno**, manteniendo **Google Apps Script (GAS)** como backend **temporal** durante las primeras fases.

## Coexistencia React + GAS (temporal)

- **Legacy (`ETRugby7`)**: continúa siendo el sistema principal en producción/uso y se mantiene **intacto**.
- **Frontend React (nuevo)**: se desarrolla en un proyecto separado (`ETR7_Migracion_React/frontend-react`).
- **Backend temporal**: GAS seguirá atendiendo funcionalidades mientras los módulos se migran gradualmente al frontend React.

## Estrategia incremental

La migración se realizará por **módulos** y con **coexistencia controlada**:

- Se migran funcionalidades de forma incremental (p. ej., login, menú, módulos posteriores).
- El legacy permanece operativo mientras el frontend React incorpora progresivamente capacidades.
- El cambio de origen (legacy → React) se hace con **cortes pequeños** y reversibles.

## Separación frontend / backend

- **Frontend**: UI/UX, navegación, estados de pantalla, validación de formularios, llamadas a APIs.
- **Backend (GAS temporal)**: reglas de acceso/seguridad existentes, operaciones sobre datos, endpoints temporales.
- **Contratos compartidos (futuro)**: se consolidarán definiciones de APIs y modelos para reducir acoplamiento.

## Principio de no contaminación del legacy

- No se mueve, copia ni refactoriza el proyecto `ETRugby7`.
- No se añade tooling React dentro del legacy.
- La migración vive **en paralelo** y se integra mediante puntos de acoplamiento definidos (APIs/contratos).

## Principios arquitectónicos iniciales

- **Desacoplamiento**: frontend React y backend GAS evolucionan de forma independiente.
- **Progresividad**: entregas pequeñas, medibles y reversibles.
- **Contratos primero (cuando aplique)**: estabilizar APIs/modelos para reducir fricción de migración.
- **Escalabilidad organizativa**: documentación, análisis y roadmap como artefactos de primera clase.


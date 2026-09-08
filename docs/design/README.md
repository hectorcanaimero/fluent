# Diseño de Fluent (Pen)

Archivo fuente: `fluent.pen` (Pen 2.17, JSON). Se lee con cualquier parser JSON; los nodos son `frame`, `text`, `icon`, `ref` (instancia de componente), `rectangle`, `ellipse`, `path`. Las pantallas son los frames de nivel superior con `reusable: false`; los componentes, los `reusable: true`.

## Tokens (variables del archivo)

| Token | Valor | Uso en Flutter (`app/theme.dart`) |
|---|---|---|
| bg | #FAF8F4 | `scaffoldBackgroundColor` |
| surface | #FFFFFF | tarjetas, burbujas |
| primary | #0E9C8C | acciones, tab activo, streak |
| primary-dark | #0B7D71 | pressed, texto sobre primary-soft |
| primary-soft | #DDF3EF | fondos suaves, chip seleccionado |
| accent | #F0813B | XP, llamas, énfasis cálido |
| accent-soft | #FDEBDC | |
| gold | #F4B63F · gold-soft #FDF1D6 | badges, nivel |
| text-primary | #1C2024 | |
| text-secondary | #6F7680 | |
| text-muted | #A3A9B2 | |
| border | #ECE7DF | |
| locked | #F1EEE9 | elementos bloqueados |
| success | #2FA36B · error #E2574C | |
| font | Plus Jakarta Sans | pesos 500, 600, 700, 800 |
| radius-lg / md / pill | 20 / 14 / 999 | |
| screen-pad | 20 | padding horizontal |

Escala tipográfica observada: 28/800 y 22/800 títulos; 18/700, 16/700, 15/600-700 subtítulos y botones; 13/600 y 12/500 cuerpo y metadatos; 11/700 en mayúsculas para etiquetas de sección.

## Componentes reutilizables

Status Bar, Button Primary (350×56), Button Secondary, Chip, Chip Selected, Tab Bar (Home · Practice · Progress · Profile), Topic Card (167 de ancho, 2 columnas), News Card (fuente, hora, título, resumen, botón "Talk about this"), AI Bubble, User Bubble, Badge, Icon Button (44×44).

## Pantallas y correspondencia con SPEC-06

| Pantalla en Pen | Ruta de SPEC-06 | Notas |
|---|---|---|
| 01 Onboarding · Welcome | `/login` (parcial) | Pantalla de bienvenida con tres beneficios y "Log in". Falta el formulario de email y contraseña y el campo de código de invitación. |
| 02 Onboarding · Level | `/onboarding` paso 2 | Usa Beginner / Intermediate / Advanced. Se mapean a A2 / B1 / B2. Incluye "placement chat de 1 minuto" que no está en el PRD: queda como P2. |
| 03 Onboarding · Interests | `/onboarding` paso 3 | 8 chips; el catálogo de la API tiene 24, se muestran los 8 del diseño primero y "Ver más". |
| 04 Home | `/` | Saludo, streak con semana, nivel y barra de XP, "Today's sessions" con mañana y tarde, temas rápidos, noticia del día. Encaja con SPEC-06 §4.1; añadir tarjeta de hechos pendientes y banner sin proveedor con el mismo estilo de tarjeta. Falta tarjeta de grupo. |
| 05 Topics · Topics tab | `/session/new` | Dos pestañas (Topics, News) y "Surprise me". La spec tiene tres (falta Roleplay): se añade como tercera pestaña con el mismo Topic Card. |
| 06 Topics · News tab | `/session/new` | News Card. |
| 07 Conversation | `/session/:id` | Temporizador, burbujas, micrófono grande, "Or type your reply…", ayudas "Need a hint?", "Translate", "Say it slower". Las tres ayudas no están en la spec: "Say it slower" se mapea al control de velocidad de TTS; "Translate" y "Hint" quedan P2 porque costarían una llamada extra. Componente `Correction` define cómo se muestra una corrección dentro de la burbuja. |
| 08 Session Summary | `/session/:id/summary` | XP, corregidos, streak, frases usadas, "Share your streak". |
| 09 Progress | `/progress` | Calendario mensual, nivel y XP desglosado, temas dominados, badges. El desglose de XP por fuente coincide con `xp_events`. Badges y "temas dominados" no están en el PRD: quedan P2. |
| 10 Profile | `/settings` | Nivel, intereses, meta diaria, recordatorios (8:00 y 19:00), alerta de streak, sonido, cuenta, "Fluent Plus" (no aplica en v1), logout. |

## Pantallas que faltan en el diseño

Se construyen siguiendo los componentes y tokens de arriba, y se marcan en el PR para que el operador las diseñe después:

1. Login y registro con código de invitación (`/login`, `/register`).
2. Onboarding paso 1 (nombre) y paso 4 (conectar proveedor).
3. Proveedores y modelos (`/providers`), incluida la selección por tiers.
4. Memoria "Lo que recuerdo de vos" (`/memory`).
5. Grupo: leaderboard, desafíos, resumen semanal (`/group`). Decidido 2026-09-08: la Tab Bar pasa a Home · Practicar · Grupo · Progreso, y Perfil se abre desde el avatar de la cabecera de Home.
6. Boss battle: variante del Topic Card y del cierre.

## Diferencias con el PRD a decidir

- Decidido 2026-09-08: interfaz en español y portugués de Brasil. Los textos en inglés del diseño son el copy base y se traducen a los dos idiomas en los archivos ARB.
- El diseño plantea "mañana y tarde" como dos sesiones fijas con hora. El PRD habla de dos sesiones al día sin franja fija. Se adopta lo del diseño: dos huecos con recordatorio configurable, sin obligar a la franja.
- "Fluent Plus" y "Connected accounts: Google · Apple" quedan fuera de v1.

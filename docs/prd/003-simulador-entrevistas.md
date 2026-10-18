---
type: prd
project_id: fluent
version: 0.1
status: accepted
generated_by: orch-prd
generated_at: 2026-10-17
title: Simulador de entrevistas técnicas
---

# Simulador de entrevistas técnicas

## Problema

Quien practica inglés para cambiar de trabajo no tiene dónde ensayar una
entrevista real en inglés. Fluent tiene un roleplay `remote-job-interview`, pero
es genérico: no conoce la oferta, ni el área, ni el nivel que pide el puesto, y
no evalúa si lo que el usuario respondió es técnicamente correcto.

Un tester (perfil técnico que apunta a empresas competitivas) pidió poder pegar
una oferta de LinkedIn, ser entrevistado sobre esa oferta y recibir al final un
parecer sobre sus fallas técnicas y de comunicación, para no repetirlas en la
entrevista real. Hoy eso se hace pagando un coach, con un amigo o no se hace.

El puesto puede ser de **cualquier área** (ingeniería, datos, producto, ventas,
salud…), así que las preguntas no pueden salir de una lista curada: tienen que
generarse a partir de la oferta y de lo que se encuentre sobre la empresa y el
rol.

## Usuarios

- **Candidato** — aprendiz A2–B2 (o más) con una entrevista en inglés por
  delante; quiere practicar con preguntas de su área y saber qué mejorar.
- **Operador** — necesita que el costo por entrevista sea acotado y predecible
  dentro de los planes Free y Pro.

## Goals

- G1 — El 50 % de los usuarios que completan una entrevista empieza el ciclo de
  estudio que resulta de ella.
- G2 — En la re-entrevista final del ciclo, el usuario mejora el nivel observado
  en al menos una competencia que había marcado como débil.
- G3 — El costo LLM + búsqueda de una entrevista completa (preparación, turnos
  y parecer) no supera el de 3 sesiones individuales.

## Non-goals

- **Conexión directa con la cuenta de LinkedIn** o scraping de LinkedIn: su
  contenido exige login y sus términos lo prohíben. Se pega el texto.
- **Veredicto de contratación** ("te contratarían / te rechazarían") ni puntaje
  único de aprobación.
- **Evaluación psicológica o psicométrica.** Lo más cercano es la entrevista
  conductual dentro del tipo mixto.
- **Análisis del CV** del usuario (candidato para una versión posterior).
- **Voz en tiempo real** del lado del servidor: se mantiene STT/TTS nativo.
- **Entrevistas en otros idiomas** distintos del inglés.

## Functional requirements

### Preparación

- **FR-1** — El usuario inicia una entrevista pegando el texto de una oferta o
  una URL, y elige el tipo: técnica o mixta (técnica + conductual).
  *Acceptance:* con texto pegado o una URL de un portal público (Greenhouse,
  Lever, Workable, página de carreras) se puede continuar.
- **FR-2** — Si la URL no se puede leer (LinkedIn, login, 404, contenido vacío),
  el sistema lo informa y pide pegar el texto. *Acceptance:* una URL de
  linkedin.com/jobs termina en el pedido de texto, no en un error genérico.
- **FR-3** — El sistema investiga la oferta: lee la URL y busca en la web
  información pública sobre la empresa, el rol y el stack o herramientas.
  *Acceptance:* el plan resultante menciona al menos un dato de la empresa o del
  rol que no estaba en el texto de la oferta, o indica que no encontró nada.
- **FR-4** — A partir de la oferta y la investigación, el sistema determina
  área, seniority y herramientas o conocimientos clave, y arma una rúbrica de 4
  a 6 competencias con el nivel esperado para ese seniority. *Acceptance:* para
  una oferta de cualquier área (probado al menos con ingeniería, datos, producto,
  ventas y salud) la rúbrica nombra competencias propias de esa área.
- **FR-5** — El sistema diseña 8 preguntas cortas y directas, repartidas entre
  las competencias (al menos una por competencia; las restantes, a las más
  importantes de la oferta), con dificultad según el seniority (concepto y
  práctica para junior; diseño, trade-offs y liderazgo para senior o lead). En
  tipo mixto 2 de las 8 son conductuales. *Acceptance:* una oferta junior y una
  senior de la misma área producen preguntas de distinta dificultad.
- **FR-6** — La preparación corre en segundo plano y el usuario ve su avance
  ("leyendo la oferta", "investigando la empresa", "armando preguntas").
  *Acceptance:* el usuario puede salir de la pantalla y volver; si termina con
  la app cerrada, recibe una notificación push.
- **FR-7** — Antes de empezar, el usuario ve un resumen del plan (área,
  seniority, competencias, cantidad de preguntas) y lo confirma o reintenta.
  *Acceptance:* el resumen no revela las preguntas.

### Entrevista

- **FR-8** — El tutor actúa como entrevistador del área: hace las preguntas del
  plan, repregunta cuando la respuesta es superficial y adapta las siguientes
  según cómo viene respondiendo. Para respetar el tiempo, hace como máximo una
  repregunta por pregunta y sus intervenciones son de 1 o 2 frases.
  *Acceptance:* ante una respuesta de una sola frase, el entrevistador pide
  profundizar una vez antes de pasar a la siguiente pregunta.
- **FR-9** — Se responde por voz (STT nativo, sin revisión: ver FR-34) o
  texto. *Acceptance:* las dos vías funcionan en la misma entrevista.
- **FR-10** — Durante la entrevista no se muestran correcciones de inglés para
  no romper el rol, pero se registran. *Acceptance:* no aparecen chips de
  corrección en la entrevista; aparecen en el parecer.
- **FR-11** — El usuario ve en qué pregunta va (n de 8) y puede terminar antes.
  *Acceptance:* con 4 respuestas o más recibe el parecer de lo respondido; con
  menos ve "todavía no alcanza para un parecer" y puede retomar o empezar de
  nuevo (pantalla IE-06d).
- **FR-11b** — La entrevista dura entre 5 y 10 minutos. Al empezar, el
  entrevistador pide respuestas de alrededor de un minuto. A los 9 minutos
  avisa que queda la última pregunta y a los 10 cierra la entrevista, aunque
  no se hayan hecho las 8; el parecer evalúa lo respondido. *Acceptance:*
  ninguna entrevista sigue aceptando respuestas después de 10 minutos de
  conversación; el tiempo en pausa no cuenta.

### Parecer

- **FR-12** — Al terminar, el usuario recibe un parecer con: por competencia,
  nivel observado frente al esperado, evidencia (cita textual de su respuesta),
  qué faltó y qué estudiar; y una sección de comunicación en inglés (claridad,
  vocabulario del área, errores frecuentes con su corrección). *Acceptance:*
  cada punto técnico incluye una cita literal de una respuesta del usuario.
- **FR-13** — El parecer se redacta como orientación constructiva, nunca como
  veredicto. *Acceptance:* el banco de prompts verifica que no aparezcan
  expresiones de contratación o rechazo.
- **FR-14** — El parecer lleva un aviso visible de que es orientativo y
  generado por IA. *Acceptance:* el aviso se ve sin hacer scroll al final.
- **FR-15** — El parecer puede verificar afirmaciones técnicas con búsqueda web
  antes de marcar una respuesta como incorrecta. *Acceptance:* cuando el parecer
  marca algo como incorrecto con verificación, lo indica.
- **FR-16** — Las entrevistas y sus pareceres quedan en el historial del
  usuario. *Acceptance:* el usuario puede abrir un parecer anterior.

### Ciclo de estudio

- **FR-17** — Desde el parecer, el usuario puede iniciar un ciclo de estudio:
  un plan de sesiones enfocadas en sus competencias y errores débiles.
  *Acceptance:* el plan lista sesiones con un foco cada una.
- **FR-18** — Las debilidades del parecer pasan a la memoria del usuario y el
  tutor las trabaja en las sesiones del ciclo. *Acceptance:* la primera sesión
  del ciclo practica al menos una debilidad del parecer.
- **FR-19** — Al completar el ciclo se ofrece una re-entrevista sobre la misma
  oferta, con preguntas distintas, y el parecer compara con el anterior.
  *Acceptance:* la re-entrevista no repite preguntas y el parecer muestra
  avance o retroceso por competencia.
- **FR-20** — Las preguntas ya hechas se guardan por usuario para no repetirse
  en entrevistas de la misma oferta o área. *Acceptance:* dos entrevistas
  seguidas sobre la misma oferta no comparten preguntas.

### Agregados por el diseño (`docs/design/fluentv3.pen`, frames IE-01 a IE-09)

- **FR-21** — La pantalla de entrada muestra cuántas entrevistas le quedan hoy y,
  si llegó al tope, lo dice y deshabilita "Preparar entrevista". *Acceptance:*
  con el tope agotado se ve "Usaste tus N entrevistas de hoy" (IE-01d).
- **FR-22** — El texto de la oferta pegado se conserva si la preparación falla o
  el usuario sale. *Acceptance:* tras un error del servicio, al volver el texto
  sigue en el campo (IE-01c).
- **FR-23** — El resumen del plan muestra una ficha de la empresa (nombre,
  industria, ciudad, modalidad), el rol, el área, el seniority, el tipo, la
  cantidad de preguntas con duración estimada y la cantidad de competencias.
  *Acceptance:* los campos que la investigación no encontró se omiten sin
  romper la ficha (IE-04, IE-03a).
- **FR-24** — Durante la entrevista se muestra la competencia de la pregunta
  actual y hay ayudas: repetir la pregunta, traducirla y decirla más lento.
  *Acceptance:* las tres ayudas funcionan sin contar como respuesta (IE-05).
- **FR-25** — Una entrevista sin terminar se puede retomar donde quedó.
  *Acceptance:* al reabrirla desde el historial continúa en la pregunta
  siguiente a la última respondida, con el mismo plan.
- **FR-26** — El nivel observado y el esperado usan la misma escala de seniority
  (Junior, Semi-senior, Senior, Staff/Lead). *Acceptance:* cada tarjeta de
  competencia muestra los dos niveles en esa escala (IE-06a).
- **FR-27** — El parecer abre con un resumen personal de 2 o 3 frases dirigido
  al usuario por su nombre ("Así te vi, María"). *Acceptance:* el resumen nombra
  al menos una fortaleza y un foco de mejora.
- **FR-28** — *Descartado (2026-10-17).* El parecer y la comparación no se
  comparten: no hay botón de compartir ni exportación. Ver NFR-5.
- **FR-29** — Las sesiones del ciclo se desbloquean en orden. Cada una tiene foco
  (una competencia o "Tu inglés"), título, duración estimada y formato
  (conversación guiada o roleplay). La re-entrevista se desbloquea al completar
  todas. *Acceptance:* la sesión 3 no se puede empezar sin haber hecho la 2
  (IE-07).
- **FR-30** — La comparación de la re-entrevista muestra por competencia el nivel
  anterior y el nuevo con estado (avanzó, igual, retrocedió), más la evolución
  de los errores de inglés repetidos. Lo que retrocedió entra en el siguiente
  ciclo. *Acceptance:* una competencia que bajó aparece como foco del ciclo
  siguiente (IE-08).
- **FR-31** — El historial lista las entrevistas por mes, con empresa, rol, tipo,
  fecha y estado: Preparando, Sin terminar, Parecer listo, Ciclo n de N y
  Re-entrevista hecha. Desde ahí se inicia una entrevista nueva. *Acceptance:*
  cada estado lleva a la pantalla correspondiente (IE-09).
- **FR-32** — Notificaciones push (en el idioma de interfaz, sin datos
  sensibles en el texto: solo empresa y rol):
  - *Entrevista lista:* "Tu entrevista para {rol} en {empresa} está lista.
    ¿Empezamos?" → abre el resumen del plan (IE-04).
  - *Preparación fallida:* "No pudimos preparar tu entrevista para {empresa}.
    Toca para intentarlo de nuevo." → abre IE-03b.
  - *Parecer listo* (cuando se generó en segundo plano): "Tu parecer de
    {empresa} está listo." → abre el parecer (IE-06a).
  - *Ciclo de estudio:* un recordatorio al día siguiente de la última sesión
    del ciclo si no hizo la próxima: "Te toca la sesión {n} de 5: {título}." →
    abre el ciclo (IE-07). Como máximo uno por día y nunca dos días seguidos.

  *Acceptance:* con la app cerrada, cada evento genera su notificación y al
  tocarla se abre la pantalla indicada; el usuario puede desactivarlas desde
  los ajustes de notificaciones existentes.
- **FR-33** — El simulador es gratis para todos los planes por ahora y se
  avisa que puede pasar al plan Pro. *Acceptance:* la pantalla de entrada y el
  resumen del plan muestran un aviso breve: "Gratis por ahora. En el futuro
  esta función podría ser parte del plan Pro."
- **FR-34** — En la entrevista, la respuesta por voz se envía sin pantalla de
  revisión: al tocar el micrófono para terminar, o cuando el STT corta por
  silencio, la transcripción se envía directo y queda en el chat sin poder
  editarse. Las sesiones normales mantienen la revisión (RF-3.1 del PRD v1).
  *Acceptance:* responder por voz en la entrevista requiere un solo toque y la
  transcripción enviada es la que llega al parecer.
- **FR-35** — El parecer sabe que las respuestas vienen del STT y no marca como
  error de inglés ni técnico lo que probablemente sea un error de
  transcripción (palabras que suenan parecido, términos técnicos mal
  reconocidos). *Acceptance:* en el banco de pruebas, una respuesta con "cash"
  en un contexto donde corresponde "cache" no genera un error en el parecer.

## Non-functional requirements

- **NFR-1 — Restricción de stack.** La preparación (investigación + diseño) y el
  parecer corren en un servicio nuevo en Python con Agno. Los turnos de la
  entrevista corren en la API NestJS existente con su pipeline LLM. La memoria
  del usuario sigue viviendo en Nest como única fuente de verdad.
- **NFR-2 — Modelos.** Todas las llamadas pasan por el 9router del operador. El
  parecer usa el combo Pro aunque el usuario sea Free; los turnos usan el combo
  del plan del usuario.
- **NFR-3 — Costo.** Tope diario de entrevistas por plan, configurable. Los
  turnos de la entrevista descuentan del tope diario de turnos existente.
- **NFR-4 — Latencia.** Preparación completa en menos de 90 s (p90). Primer
  token del entrevistador igual que en las sesiones individuales.
- **NFR-5 — Privacidad.** Ofertas, respuestas y pareceres son privados del
  usuario; el grupo no los ve (como las conversaciones). Al buscar en la web
  solo se envían datos de la oferta, nunca datos del usuario.
- **NFR-6 — Robustez.** Si la búsqueda web falla, la preparación sigue solo con
  la oferta. Si el servicio de preparación no responde, el usuario ve un error
  con reintento y no se consume su tope.
- **NFR-7 — Idioma.** La entrevista es en inglés; el parecer, la interfaz y
  las notificaciones, en el idioma de interfaz del usuario: español neutro de
  Latinoamérica (tuteo: "pega", "puedes", "toca"; nunca voseo rioplatense) o
  portugués de Brasil.
- **NFR-8 — Plan.** El simulador no exige plan Pro. El tope diario es el mismo
  para todos y la verificación de plan queda preparada para activarse por
  configuración, sin cambiar la app.

## Assumptions

- Tope inicial: 3 entrevistas por día para todos (como muestra el diseño).
- Duración: 8 preguntas en un máximo de 10 minutos (decisión del operador).
  Con el flujo de voz actual (revisión antes de enviar y TTS de la respuesta
  completa) cada ciclo ronda 1:15, así que 8 preguntas entran justo; si en
  pruebas la mayoría no llega a la 8, se sube el tope o se bajan las
  preguntas.
- Ciclo de estudio de 5 sesiones de 10–15 min; el usuario puede saltarlo.
- La entrada al simulador vive en la pestaña Practicar (el diseño muestra la
  tab bar actual: Inicio, Practicar, Grupo, Progreso).
- Mínimo de 4 respuestas para generar un parecer (IE-06d).
- La búsqueda web arranca con un proveedor gratuito y se cambia si la calidad
  no alcanza.
- Una entrevista completa suma XP y cuenta para la racha como una sesión.

## Open questions

Ninguna.

## Resolved questions

- El ciclo de estudio se suma a las sesiones del día; no las reemplaza. Una
  sesión del ciclo cuenta para XP y racha como cualquier sesión. — operador,
  2026-10-18.
- En el resumen semanal del grupo las entrevistas aparecen solo como conteo y
  XP, sin empresa, rol ni parecer (NFR-5). — operador, 2026-10-18.

- Gratis para todos por ahora, con aviso de que puede pasar a Pro (FR-33,
  NFR-8). — operador, 2026-10-17.
- No se comparte nada: FR-28 descartado. — operador, 2026-10-17.
- Entrevista de 8 preguntas en 5 a 10 minutos (FR-5, FR-11, FR-11b). —
  operador, 2026-10-17.
- Español neutro latinoamericano, sin voseo (NFR-7). — operador, 2026-10-17.
- Se suman las notificaciones push (FR-32). — operador, 2026-10-17.
- La entrevista envía la voz sin revisión y el parecer tolera errores de STT
  (FR-34, FR-35). Modo llamada real queda fuera por ahora. — operador,
  2026-10-17.

## Milestones

- M1 — Preparación: pegar oferta o URL, investigación, plan y resumen: FR-1,
  FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-21, FR-22, FR-23, FR-33.
- M2 — Entrevista y parecer: entrevistador del área, parecer técnico y de
  inglés, historial, push: FR-8, FR-9, FR-10, FR-11, FR-11b, FR-12, FR-13,
  FR-14, FR-15, FR-16, FR-24, FR-25, FR-26, FR-27, FR-31, FR-32, FR-34,
  FR-35.
- M3 — Ciclo de estudio: plan, memoria, re-entrevista, no repetir preguntas:
  FR-17, FR-18, FR-19, FR-20, FR-29, FR-30.

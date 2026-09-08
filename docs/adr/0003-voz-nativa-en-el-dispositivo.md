# ADR 0003 — STT y TTS nativos en el móvil

Fecha: 2026-09-08 · Estado: Aceptado

## Contexto
La conversación es por voz. Los servicios externos de STT/TTS tienen costo por minuto y añaden latencia y complejidad de streaming de audio. El PRD prioriza costo cero y sesiones de 10 minutos.

## Decisión
- Reconocimiento de voz con las APIs del sistema: `SpeechRecognizer` en Android y `Speech` en iOS, vía el plugin `speech_to_text`.
- Síntesis con el TTS del sistema vía `flutter_tts`, con control de velocidad.
- El backend solo recibe y devuelve texto. No se guarda audio en v1.
- El usuario ve la transcripción y puede corregirla antes de enviarla (mitiga errores de reconocimiento con acento hispano).

## Alternativas consideradas
- **Whisper / Deepgram / ElevenLabs.** Mejor calidad, pero costo, latencia y una dependencia más. Se reconsidera si el STT nativo resulta inutilizable.
- **Modelos de audio del propio LLM.** Fuera del alcance de los modelos gratuitos y del principio de una llamada por turno.

## Consecuencias
- La calidad de voz depende del dispositivo y del idioma configurado. Hay que forzar `en-US` en el reconocedor.
- Modo texto (RF-3.3) como alternativa cuando el reconocimiento falle.
- Los tests de conversación pueden hacerse por texto contra la API sin dispositivo.

/// Configuración de entorno leída con `--dart-define`.
///
/// Ejemplo de build real:
/// ```
/// flutter run \
///   --dart-define=API_URL=https://fluent-api.example.com/v1 \
///   --dart-define=INSFORGE_URL=https://xyz.us-east-1.insforge.app \
///   --dart-define=INSFORGE_ANON_KEY=anon_xxxxx \
///   --dart-define=USE_FAKE_API=false
/// ```
class Env {
  const Env._();

  /// URL base de la API de Fluent (NestJS), sin barra final.
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://fluent-api.local/v1',
  );

  /// URL base del proyecto InsForge usado para auth.
  static const String insforgeUrl = String.fromEnvironment(
    'INSFORGE_URL',
    defaultValue: 'https://insforge.local',
  );

  /// Anon key del proyecto InsForge (SPEC-06 §6). InsForge exige
  /// `Authorization: Bearer <INSFORGE_ANON_KEY>` en las llamadas de auth sin
  /// sesión (alta, inicio de sesión, refresh); sin ella responde
  /// `AUTH_INVALID_CREDENTIALS "No token provided"`. Nunca lleva un valor
  /// real en el repo: se pasa con `--dart-define` en cada build.
  static const String insforgeAnonKey = String.fromEnvironment(
    'INSFORGE_ANON_KEY',
    defaultValue: '',
  );

  /// Cuando es `true` (por defecto durante el desarrollo del PR-06) la app
  /// usa [FakeApi] en lugar de llamadas HTTP reales. Se apaga en T9.
  static const bool useFakeApi = bool.fromEnvironment(
    'USE_FAKE_API',
    defaultValue: true,
  );

  /// Esquema del deep link de retorno de PKCE (`fluent://oauth/openrouter`).
  static const String oauthCallbackScheme = 'fluent';
  static const String oauthCallbackUrl = 'fluent://oauth/openrouter';
}

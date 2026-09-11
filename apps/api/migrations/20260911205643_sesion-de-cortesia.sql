-- MAL-24: una sesión de cortesía por usuario, con la credencial del owner
-- de su grupo y solo la cadena gratuita.
--
-- El cuello de botella de activación es que la primera conversación exige
-- salir de la app a crear una API key. Con esto, un usuario recién invitado
-- puede hablar una vez antes de conectar nada, y `/providers` se le pide
-- después de haber visto para qué sirve.
--
-- La marca es un timestamp y no un booleano para poder responder «cuándo la
-- usó» sin otra tabla; `NULL` significa que le queda.

ALTER TABLE public.profiles
  ADD COLUMN courtesy_session_used_at timestamptz;

COMMENT ON COLUMN public.profiles.courtesy_session_used_at IS
  'MAL-24: cuándo gastó su única sesión de cortesía; NULL si aún le queda.';

-- La marca vive también en la sesión: cada turno necesita saber de quién es
-- la credencial, no solo la apertura. Sin esto el primer turno de una sesión
-- de cortesía fallaba con PROVIDER_NOT_CONNECTED y el usuario se quedaba con
-- el saludo y nada más, habiendo gastado ya su única sesión gratuita.
ALTER TABLE public.sessions
  ADD COLUMN courtesy boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sessions.courtesy IS
  'MAL-24: la sesión corre con la credencial del owner del grupo.';

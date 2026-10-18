-- profiles.timezone con alias antiguos de tzdata (`US/Pacific`, `Brazil/East`…)
-- que el Postgres de InsForge no reconoce: `close_session` y los cálculos de
-- racha fallan con "time zone not recognized". La API ya guarda el nombre
-- canónico; esto arregla las filas que quedaron de antes.
--
-- ponytail: solo los alias de las regiones de nuestros usuarios (América);
-- otro alias que aparezca se agrega a la lista.
UPDATE public.profiles p
   SET timezone = m.canonical
  FROM (VALUES
    ('US/Pacific',        'America/Los_Angeles'),
    ('US/Mountain',       'America/Denver'),
    ('US/Arizona',        'America/Phoenix'),
    ('US/Central',        'America/Chicago'),
    ('US/Eastern',        'America/New_York'),
    ('US/Alaska',         'America/Anchorage'),
    ('US/Hawaii',         'Pacific/Honolulu'),
    ('Canada/Pacific',    'America/Vancouver'),
    ('Canada/Eastern',    'America/Toronto'),
    ('Mexico/General',    'America/Mexico_City'),
    ('Brazil/East',       'America/Sao_Paulo'),
    ('Brazil/West',       'America/Manaus'),
    ('Brazil/Acre',       'America/Rio_Branco'),
    ('Chile/Continental', 'America/Santiago'),
    ('America/Buenos_Aires', 'America/Argentina/Buenos_Aires')
  ) AS m(alias, canonical)
 WHERE p.timezone = m.alias
   AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p.timezone);

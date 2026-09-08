/**
 * Smoke de las migraciones 1 y 2 (SPEC-01 §2.1-§2.5, §3, §5) contra InsForge
 * por REST.
 *
 * Comprueba, con dos usuarios reales creados por la API de auth:
 *   1. `redeem_invitation` asigna el grupo y marca la invitación usada.
 *   2. El usuario A NO lee el perfil completo del usuario B (RLS de `profiles`).
 *   3. El usuario A SÍ ve a B en la vista `group_members`, y solo las columnas
 *      visibles de RF-6.5.
 *   4. El usuario A no puede tocar columnas protegidas de su propio perfil (xp).
 *   5. (T2) El usuario A no lee `provider_credentials` (403/4xx o vacío).
 *   6. (T2) El usuario A solo ve su propia fila en `model_preferences` y
 *      puede hacer PATCH de `chat_model` sobre ella.
 *   7. (T3) El usuario A solo ve sus sesiones, turnos y correcciones, no lee
 *      `xp_events` ni `llm_calls`, y no puede invocar `close_session`.
 *
 * Uso (desde apps/api, con .insforge/project.json enlazado a la rama):
 *   node scripts/db-smoke.ts
 *
 * Requiere `requireEmailVerification = false` en la configuración del proyecto
 * (SPEC-06 §6; lo desactiva PR-08/T2). Si sigue activo, el script lo detecta,
 * deja los usuarios creados y termina con un aviso en vez de un fallo.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const projectFile = resolve(here, '..', '.insforge', 'project.json');

type ProjectJson = { oss_host: string; api_key: string; project_name?: string };

const project: ProjectJson = JSON.parse(readFileSync(projectFile, 'utf8'));
const HOST = project.oss_host.replace(/\/$/, '');
const ADMIN_KEY = project.api_key;

const RUN = Date.now().toString(36);
const PASSWORD = `Fluent-${RUN}-smoke`;

let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FALLA ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
  }
}

type Res = { status: number; body: any };

async function call(
  path: string,
  init: RequestInit & { token?: string; admin?: boolean } = {},
): Promise<Res> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.admin) headers.set('Authorization', `Bearer ${ADMIN_KEY}`);
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  const res = await fetch(`${HOST}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON */
  }
  return { status: res.status, body };
}

function fail(step: string, res: Res): never {
  console.error(`\n✗ ${step} → HTTP ${res.status}`);
  console.error(JSON.stringify(res.body, null, 2));
  process.exit(1);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function invitationCode(): string {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

async function signUp(tag: string): Promise<{ id: string; email: string; token?: string }> {
  const email = `smoke-${RUN}-${tag}@fluent.test`;
  // El alta exige una clave del proyecto (anon en la app, admin aquí).
  const res = await call('/api/auth/users?client_type=mobile', {
    admin: true,
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD, name: `Smoke ${tag.toUpperCase()}` }),
  });
  if (res.status >= 300) fail(`crear usuario ${tag}`, res);
  const id: string | undefined = res.body?.user?.id ?? res.body?.data?.user?.id ?? res.body?.id;
  const token: string | undefined = res.body?.accessToken ?? res.body?.data?.accessToken;
  if (!id) fail(`id del usuario ${tag}`, res);
  return { id, email, token };
}

async function signIn(email: string): Promise<string | undefined> {
  const res = await call('/api/auth/sessions?client_type=mobile', {
    admin: true,
    method: 'POST',
    body: JSON.stringify({ method: 'password', email, password: PASSWORD }),
  });
  if (res.status >= 300) {
    console.warn(`  aviso: no se pudo abrir sesión (${res.status}): ${JSON.stringify(res.body)}`);
    return undefined;
  }
  return res.body?.accessToken ?? res.body?.data?.accessToken;
}

async function main(): Promise<void> {
  console.log(`Smoke SPEC-01 contra ${HOST}`);

  // --- Grupo e invitaciones (rol admin) -----------------------------------
  const groupRes = await call('/api/database/records/groups', {
    admin: true,
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ name: `Smoke ${RUN}` }]),
  });
  if (groupRes.status >= 300) fail('crear grupo', groupRes);
  const groupId: string = (Array.isArray(groupRes.body) ? groupRes.body[0] : groupRes.body).id;
  console.log(`  grupo ${groupId}`);

  const codeA = invitationCode();
  const codeB = invitationCode();
  const invRes = await call('/api/database/records/invitations', {
    admin: true,
    method: 'POST',
    body: JSON.stringify([
      { code: codeA, group_id: groupId },
      { code: codeB, group_id: groupId },
    ]),
  });
  if (invRes.status >= 300) fail('crear invitaciones', invRes);

  // --- Dos usuarios --------------------------------------------------------
  const a = await signUp('a');
  const b = await signUp('b');
  console.log(`  usuarios ${a.id} / ${b.id}`);

  const profRes = await call('/api/database/records/profiles', {
    admin: true,
    method: 'POST',
    // PostgREST exige las mismas claves en todos los objetos de un lote.
    body: JSON.stringify([
      { user_id: a.id, display_name: 'Smoke A', level: 'B1', xp: 0, streak: 0, onboarded_at: new Date().toISOString() },
      { user_id: b.id, display_name: 'Smoke B', level: 'A2', xp: 120, streak: 3, onboarded_at: new Date().toISOString() },
    ]),
  });
  if (profRes.status >= 300) fail('crear perfiles', profRes);

  // --- redeem_invitation (RPC con clave admin) -----------------------------
  for (const [user, code] of [
    [a, codeA],
    [b, codeB],
  ] as const) {
    const res = await call('/api/database/rpc/redeem_invitation', {
      admin: true,
      method: 'POST',
      body: JSON.stringify({ p_code: code, p_user_id: user.id }),
    });
    if (res.status >= 300) fail(`redeem_invitation ${user.email}`, res);
    check(`redeem_invitation devuelve el grupo (${user.email})`, res.body?.group_id === groupId, res.body);
  }

  const reused = await call('/api/database/rpc/redeem_invitation', {
    admin: true,
    method: 'POST',
    body: JSON.stringify({ p_code: codeA, p_user_id: a.id }),
  });
  check('un código ya usado no se puede canjear dos veces', reused.status >= 400, reused.body);

  // --- Sesión del usuario A ------------------------------------------------
  const tokenA = a.token ?? (await signIn(a.email));
  if (!tokenA) {
    console.warn(
      '\n⚠ No hay token de usuario: el proyecto exige verificación de email ' +
        '(metadata.requireEmailVerification). Los usuarios quedan creados; las ' +
        'comprobaciones de RLS quedan pendientes de PR-08/T2, que desactiva la ' +
        'verificación (SPEC-06 §6).',
    );
    process.exit(failures === 0 ? 0 : 1);
  }

  const own = await call('/api/database/records/profiles?select=*', { token: tokenA });
  check('A lee su propio perfil', own.status === 200 && Array.isArray(own.body) && own.body.length === 1, own.body);
  check('A solo ve su fila en profiles', Array.isArray(own.body) && own.body[0]?.user_id === a.id, own.body);

  const other = await call(`/api/database/records/profiles?user_id=eq.${b.id}`, { token: tokenA });
  check(
    'A NO lee el perfil completo de B',
    other.status === 200 && Array.isArray(other.body) && other.body.length === 0,
    { status: other.status, body: other.body },
  );

  const members = await call('/api/database/records/group_members?order=display_name', { token: tokenA });
  check('A ve la vista group_members', members.status === 200 && Array.isArray(members.body), members.body);
  const memberB = Array.isArray(members.body)
    ? members.body.find((m: any) => m.user_id === b.id)
    : undefined;
  check('group_members incluye a B', Boolean(memberB), members.body);
  if (memberB) {
    check('group_members expone xp y streak de B', memberB.xp === 120 && memberB.streak === 3, memberB);
    const expuestas = Object.keys(memberB).sort().join(',');
    check(
      'group_members expone solo las columnas de RF-6.5',
      expuestas === 'display_name,group_id,last_session_day,level,streak,user_id,xp',
      expuestas,
    );
  }

  const bumpXp = await call(`/api/database/records/profiles?user_id=eq.${a.id}`, {
    token: tokenA,
    method: 'PATCH',
    body: JSON.stringify({ xp: 9999 }),
  });
  check('A no puede modificar su xp', bumpXp.status >= 400, { status: bumpXp.status, body: bumpXp.body });

  const rename = await call(`/api/database/records/profiles?user_id=eq.${a.id}`, {
    token: tokenA,
    method: 'PATCH',
    body: JSON.stringify({ display_name: 'Smoke A renombrado' }),
  });
  check('A sí puede cambiar su display_name', rename.status < 300, {
    status: rename.status,
    body: rename.body,
  });

  const invPeek = await call('/api/database/records/invitations', { token: tokenA });
  check(
    'A no lee invitations',
    invPeek.status >= 400 || (Array.isArray(invPeek.body) && invPeek.body.length === 0),
    { status: invPeek.status, body: invPeek.body },
  );

  // --- T2: provider_credentials y model_preferences (migración 2) ----------
  const credsPeek = await call('/api/database/records/provider_credentials', { token: tokenA });
  check(
    'A no lee provider_credentials',
    credsPeek.status >= 400 || (Array.isArray(credsPeek.body) && credsPeek.body.length === 0),
    { status: credsPeek.status, body: credsPeek.body },
  );

  const prefsRes = await call('/api/database/records/model_preferences', {
    admin: true,
    method: 'POST',
    body: JSON.stringify([
      { user_id: a.id, chat_model: 'openrouter/chat-a', brief_model: 'openrouter/brief-a' },
      { user_id: b.id, chat_model: 'openrouter/chat-b', brief_model: 'openrouter/brief-b' },
    ]),
  });
  if (prefsRes.status >= 300) fail('crear model_preferences', prefsRes);

  const ownPrefs = await call('/api/database/records/model_preferences', { token: tokenA });
  check(
    'A solo ve su propia fila en model_preferences',
    ownPrefs.status === 200 &&
      Array.isArray(ownPrefs.body) &&
      ownPrefs.body.length === 1 &&
      ownPrefs.body[0]?.user_id === a.id,
    ownPrefs.body,
  );

  const patchPrefs = await call(`/api/database/records/model_preferences?user_id=eq.${a.id}`, {
    token: tokenA,
    method: 'PATCH',
    body: JSON.stringify({ chat_model: 'openrouter/chat-a-renombrado' }),
  });
  check('A puede hacer PATCH de chat_model sobre su propia fila', patchPrefs.status < 300, {
    status: patchPrefs.status,
    body: patchPrefs.body,
  });

  // --- T3: sesiones, turnos, correcciones y auditoría (migración 3) --------
  const sessRes = await call('/api/database/records/sessions', {
    admin: true,
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([
      { user_id: a.id, kind: 'free_topic', topic: 'Sesión de A' },
      { user_id: b.id, kind: 'free_topic', topic: 'Sesión de B' },
    ]),
  });
  if (sessRes.status >= 300) fail('crear sesiones', sessRes);
  const [sessionA, sessionB] = sessRes.body as Array<{ id: string }>;

  const turnsRes = await call('/api/database/records/turns', {
    admin: true,
    method: 'POST',
    body: JSON.stringify([
      { session_id: sessionA.id, idx: 0, role: 'user', text: 'hola de A' },
      { session_id: sessionB.id, idx: 0, role: 'user', text: 'hola de B' },
    ]),
  });
  if (turnsRes.status >= 300) fail('crear turnos', turnsRes);

  const corrRes = await call('/api/database/records/corrections', {
    admin: true,
    method: 'POST',
    body: JSON.stringify([
      { session_id: sessionA.id, user_id: a.id, turn_idx: 0, original: 'I go yesterday', corrected: 'I went yesterday', category: 'past_simple' },
      { session_id: sessionB.id, user_id: b.id, turn_idx: 0, original: 'I has', corrected: 'I have', category: 'subject_verb' },
    ]),
  });
  if (corrRes.status >= 300) fail('crear correcciones', corrRes);

  const mySessions = await call('/api/database/records/sessions', { token: tokenA });
  check(
    'A solo ve sus sesiones',
    mySessions.status === 200 &&
      Array.isArray(mySessions.body) &&
      mySessions.body.length === 1 &&
      mySessions.body[0]?.id === sessionA.id,
    mySessions.body,
  );

  const myTurns = await call('/api/database/records/turns', { token: tokenA });
  check(
    'A solo ve los turnos de sus sesiones',
    myTurns.status === 200 &&
      Array.isArray(myTurns.body) &&
      myTurns.body.length === 1 &&
      myTurns.body[0]?.session_id === sessionA.id,
    myTurns.body,
  );

  const myCorrections = await call('/api/database/records/corrections', { token: tokenA });
  check(
    'A solo ve sus correcciones',
    myCorrections.status === 200 &&
      Array.isArray(myCorrections.body) &&
      myCorrections.body.length === 1 &&
      myCorrections.body[0]?.user_id === a.id,
    myCorrections.body,
  );

  for (const tabla of ['xp_events', 'llm_calls']) {
    const res = await call(`/api/database/records/${tabla}`, { token: tokenA });
    check(
      `A no lee ${tabla}`,
      res.status >= 400 || (Array.isArray(res.body) && res.body.length === 0),
      { status: res.status, body: res.body },
    );
  }

  const closeRes = await call('/api/database/rpc/close_session', {
    admin: true,
    method: 'POST',
    body: JSON.stringify({ p_session_id: sessionA.id, p_duration_sec: 600, p_turns_count: 8 }),
  });
  check(
    'close_session por RPC devuelve el resumen de XP',
    closeRes.status < 300 && closeRes.body?.xp_earned === 80 && closeRes.body?.streak === 1,
    { status: closeRes.status, body: closeRes.body },
  );

  const closeFromApp = await call('/api/database/rpc/close_session', {
    token: tokenA,
    method: 'POST',
    body: JSON.stringify({ p_session_id: sessionA.id, p_duration_sec: 600, p_turns_count: 8 }),
  });
  check('la app no puede llamar a close_session', closeFromApp.status >= 400, {
    status: closeFromApp.status,
    body: closeFromApp.body,
  });

  // --- limpieza (las cuentas de auth se quedan: solo se borran desde la
  //     API de auth y esta rama de InsForge es desechable) ------------------
  await call(`/api/database/records/xp_events?user_id=in.(${a.id},${b.id})`, {
    admin: true,
    method: 'DELETE',
  });
  await call(`/api/database/records/sessions?user_id=in.(${a.id},${b.id})`, {
    admin: true,
    method: 'DELETE',
  });
  await call(`/api/database/records/profiles?user_id=in.(${a.id},${b.id})`, {
    admin: true,
    method: 'DELETE',
  });
  await call(`/api/database/records/model_preferences?user_id=in.(${a.id},${b.id})`, {
    admin: true,
    method: 'DELETE',
  });
  await call(`/api/database/records/invitations?group_id=eq.${groupId}`, {
    admin: true,
    method: 'DELETE',
  });
  await call(`/api/database/records/groups?id=eq.${groupId}`, { admin: true, method: 'DELETE' });

  console.log(failures === 0 ? '\n✓ smoke SPEC-01 en verde' : `\n✗ ${failures} comprobación(es) fallida(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

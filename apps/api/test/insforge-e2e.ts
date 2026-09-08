import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAdminClient, type InsForgeClient } from '@insforge/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** `apps/api/.env.test.local`, gitignored (ver apps/api/.gitignore: `.env*.local`). */
const ENV_LOCAL_PATH = join(__dirname, '..', '.env.test.local');

export interface InsforgeE2eCredentials {
  readonly insforgeUrl: string;
  readonly insforgeApiKey: string;
  readonly insforgeAnonKey: string;
}

/**
 * Parsea un `.env` a mano (`KEY=VALUE`, comentarios con `#`, líneas en
 * blanco, valores entre comillas simples o dobles opcionales). Sin
 * dependencias nuevas, como pide el alcance de PR-02/T2: solo hace falta
 * esto para un único archivo de test, así que no vale la pena `dotenv`.
 */
function parseDotEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) {
      value = value.slice(1, -1);
    }
    if (key.length > 0) {
      values[key] = value;
    }
  }

  return values;
}

/**
 * Credenciales reales de InsForge (rama `feat-api`, con las migraciones
 * aplicadas y `require_email_verification=false`) para los tests e2e:
 * primero de `process.env`, si faltan del archivo gitignored
 * `apps/api/.env.test.local`. **Nunca** imprime su contenido (ni aquí ni en
 * ningún test: si algo falla, el mensaje de error no debe incluir estos
 * valores).
 *
 * Devuelve `null` si no hay credenciales disponibles — el CI no tiene acceso
 * a InsForge (docs/tasks/PR-02-auth-y-api.md, criterio de aceptación de T2).
 * Quien llama debe hacer `describe.skip` en ese caso.
 */
export function loadInsforgeE2eCredentials(): InsforgeE2eCredentials | null {
  let fileValues: Record<string, string> = {};

  if (existsSync(ENV_LOCAL_PATH)) {
    try {
      fileValues = parseDotEnv(readFileSync(ENV_LOCAL_PATH, 'utf-8'));
    } catch {
      fileValues = {};
    }
  }

  const insforgeUrl = process.env.INSFORGE_URL || fileValues.INSFORGE_URL;
  const insforgeApiKey = process.env.INSFORGE_API_KEY || fileValues.INSFORGE_API_KEY;
  const insforgeAnonKey = process.env.INSFORGE_ANON_KEY || fileValues.INSFORGE_ANON_KEY;

  if (!insforgeUrl || !insforgeApiKey || !insforgeAnonKey) {
    return null;
  }

  return { insforgeUrl, insforgeApiKey, insforgeAnonKey };
}

/**
 * Copia las credenciales reales a `process.env` **antes** de crear el
 * módulo de Nest: `ConfigModule.forRoot` carga `.env.test` (valores
 * ficticios) con `dotenv`, que nunca pisa una variable ya presente en
 * `process.env`, así que esto hace que la API de los tests hable con la
 * rama real de InsForge en vez de con `https://example.test.insforge.app`.
 */
export function applyInsforgeE2eEnv(credentials: InsforgeE2eCredentials): void {
  process.env.INSFORGE_URL = credentials.insforgeUrl;
  process.env.INSFORGE_API_KEY = credentials.insforgeApiKey;
  process.env.INSFORGE_ANON_KEY = credentials.insforgeAnonKey;
}

export function createE2eAdminClient(credentials: InsforgeE2eCredentials): InsForgeClient {
  return createAdminClient({
    baseUrl: credentials.insforgeUrl,
    apiKey: credentials.insforgeApiKey,
  });
}

export interface E2eTestUser {
  readonly id: string;
  readonly email: string;
  readonly accessToken: string;
}

let userCounter = 0;

/**
 * Registra un usuario de prueba con email único
 * (`e2e-<timestamp>-<n>@fluent.test`) vía
 * `POST /api/auth/users?client_type=mobile` con el bearer admin (SPEC-06 §6).
 */
export async function registerE2eUser(
  credentials: InsforgeE2eCredentials,
  namePrefix = 'E2E User',
): Promise<E2eTestUser> {
  userCounter += 1;
  const email = `e2e-${Date.now()}-${userCounter}@fluent.test`;
  const password = 'Fluent-e2e-P4ssword!';

  const response = await fetch(
    `${credentials.insforgeUrl}/api/auth/users?client_type=mobile`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.insforgeApiKey}`,
      },
      body: JSON.stringify({ email, password, name: `${namePrefix} ${userCounter}` }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `No se pudo registrar el usuario de prueba (HTTP ${response.status}). ` +
        'Revisá que apps/api/.env.test.local apunte a una rama de InsForge viva.',
    );
  }

  const data = (await response.json()) as {
    user: { id: string };
    accessToken: string;
  };

  return { id: data.user.id, email, accessToken: data.accessToken };
}

/** Crea un grupo de prueba directamente con el cliente admin. */
export async function createE2eGroup(
  admin: InsForgeClient,
  name = `E2E Group ${randomUUID().slice(0, 8)}`,
  ownerId?: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await admin.database
    .from('groups')
    .insert({ name, owner_id: ownerId ?? null })
    .select('id, name')
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear el grupo de prueba: ${error?.message}`);
  }

  return data as { id: string; name: string };
}

/**
 * Crea una invitación de prueba directamente con el cliente admin.
 * `expiresInMs` negativo permite sembrar una invitación ya caducada
 * (escenario `INVITATION_EXPIRED`).
 */
export async function createE2eInvitation(
  admin: InsForgeClient,
  params: { groupId: string; createdBy?: string; expiresInMs?: number },
): Promise<string> {
  const code = randomE2eInvitationCode();
  const expiresAt = new Date(Date.now() + (params.expiresInMs ?? 14 * 24 * 60 * 60 * 1000)).toISOString();

  const { error } = await admin.database.from('invitations').insert({
    code,
    group_id: params.groupId,
    created_by: params.createdBy ?? null,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`No se pudo crear la invitación de prueba: ${error.message}`);
  }

  return code;
}

const E2E_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomE2eInvitationCode(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += E2E_CODE_ALPHABET[Math.floor(Math.random() * E2E_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Borra lo que un test haya sembrado directamente (SPEC-06 §6 e2e:
 * «limpie al final lo que pueda»). Ignora errores individuales para que un
 * fallo de limpieza no oculte el fallo real del test.
 */
export async function cleanupE2eData(
  admin: InsForgeClient,
  params: { userIds?: string[]; groupIds?: string[]; invitationCodes?: string[] },
): Promise<void> {
  for (const code of params.invitationCodes ?? []) {
    await admin.database.from('invitations').delete().eq('code', code);
  }
  for (const userId of params.userIds ?? []) {
    await admin.database.from('profiles').delete().eq('user_id', userId);
  }
  for (const groupId of params.groupIds ?? []) {
    await admin.database.from('groups').delete().eq('id', groupId);
  }
}

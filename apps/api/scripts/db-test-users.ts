/**
 * Crea (idempotente) los usuarios de prueba que usan los tests SQL de
 * `apps/api/migrations/tests/`.
 *
 * Los tests SQL no pueden crear usuarios: `auth.users` es una tabla gestionada
 * por InsForge y solo se escribe a través de la API de auth. Este script la
 * llama con la clave admin del proyecto enlazado y deja cuatro cuentas fijas
 * que los tests localizan por email.
 *
 * Uso (desde apps/api, con .insforge/project.json enlazado a la rama):
 *   node scripts/db-test-users.ts
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(
  readFileSync(resolve(here, '..', '.insforge', 'project.json'), 'utf8'),
) as { oss_host: string; api_key: string };

const HOST = project.oss_host.replace(/\/$/, '');

/** Emails fijos que buscan los tests SQL. */
export const TEST_EMAILS = [
  'sqltest-a@fluent.test',
  'sqltest-b@fluent.test',
  'sqltest-c@fluent.test',
  'sqltest-d@fluent.test',
];

const PASSWORD = 'Fluent-sqltest-2026';

async function ensureUser(email: string): Promise<string> {
  const res = await fetch(`${HOST}/api/auth/users?client_type=mobile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${project.api_key}`,
    },
    body: JSON.stringify({ email, password: PASSWORD, name: email.split('@')[0] }),
  });
  const body = await res.text();
  if (res.ok) return `creado  ${email}`;
  if (res.status === 409 || /exist/i.test(body)) return `existía ${email}`;
  throw new Error(`No se pudo crear ${email}: HTTP ${res.status} ${body}`);
}

async function main(): Promise<void> {
  for (const email of TEST_EMAILS) {
    console.log(`  ${await ensureUser(email)}`);
  }
  console.log('Usuarios de prueba listos.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { createRequire } from 'node:module';

// `createRequire` en vez de `import ... with { type: 'json' }` para no tocar
// tsconfig (ver docs/specs/PENDIENTES.md). La ruta relativa funciona tanto
// en `src/config/version.ts` como compilada en `dist/config/version.ts`,
// porque `package.json` queda dos niveles por encima en ambos casos.
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

export const APP_VERSION: string = pkg.version;

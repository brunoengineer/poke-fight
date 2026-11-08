// Starts Vitest from the folder's real path. `npm test` runs this.
//
// Why: on Windows, a shell can start in `c:\…` (lowercase drive) instead of `C:\…`. Vitest then loads itself twice
// (`c:` and `C:` look like two different files to Node) and every test file fails with
// "Cannot read properties of undefined (reading 'config')". The real path from the file system always has the right
// case. Fixing it in vite.config.ts is too late: Vitest is already loaded by then.

import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

const cwd = realpathSync.native(process.cwd());
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);

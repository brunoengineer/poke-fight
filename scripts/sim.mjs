// npm run sim -- <experiment> [options]: the fight lab (docs/fight-lab.md). The simulation is the game's own
// TypeScript (src/sim/), loaded through Vite's module runner, so it plays exactly the fights the game plays.

import { createServer, createServerModuleRunner } from 'vite';

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { main } = await runner.import('/src/sim/cli.ts');
  main(process.argv.slice(2));
  await runner.close();
} finally {
  await server.close();
}

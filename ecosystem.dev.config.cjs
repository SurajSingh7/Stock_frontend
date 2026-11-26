/** @type {import('pm2').App[]} */
// Local development: `next dev` hot-reloads on every save, no rebuild needed.
// Same pm2 name as the production app (ecosystem.config.cjs) on purpose — both
// serve port 3000, so only one of them should ever be running.
module.exports = {
  apps: [
    {
      name: 'stock-frontend',
      // Runs `next dev` with its server child forced windowless — see the file.
      script: './pm2-next-dev.cjs',
      // NO pm2 watch. `next dev` already hot-reloads every save by itself; a pm2
      // watch on top restarted the whole server on each change, and on Windows
      // every restart opened a fresh "next-server" console window on screen.
      // Restart by hand (pm2 restart stock-frontend) only after changing
      // next.config.mjs or .env.
      watch: false,
      windowsHide: true,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};

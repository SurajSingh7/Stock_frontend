/** @type {import('pm2').App[]} */
// Local development: `next dev` hot-reloads on every save, no rebuild needed.
// Same pm2 name as the production app (ecosystem.config.cjs) on purpose — both
// serve port 3000, so only one of them should ever be running.
module.exports = {
  apps: [
    {
      name: 'stock-frontend',
      script: './node_modules/next/dist/bin/next',
      args: 'dev',
      // pm2 restarts the whole dev server when a watched file changes (on top
      // of next dev's own hot reload). Next writes into .next constantly, so it
      // MUST stay ignored — watching it restarts the server in a loop.
      watch: true,
      ignore_watch: ['node_modules', '.next', '.git', 'public/uploads'],
      watch_delay: 1500,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};

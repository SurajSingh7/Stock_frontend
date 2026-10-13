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
      watch: false, // next dev already watches files itself
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};

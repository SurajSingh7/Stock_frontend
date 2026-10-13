/** @type {import('pm2').App[]} */
module.exports = {
  apps: [
    {
      name: 'stock-frontend',
      // next ka JS entry seedha chalate hain — `npm start` Windows pe pm2 ke saath npm.cmd ki wajah se fail hota hai
      script: './node_modules/next/dist/bin/next',
      args: 'start',
      max_memory_restart: '500M',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

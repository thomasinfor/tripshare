module.exports = {
  apps: [
    {
      name: 'tripshare',
      cwd: '/home/thomaswang/project/tripshare',
      script: './server.mjs',
      interpreter: '/home/thomaswang/.nvm/versions/node/v24.11.1/bin/node',
      node_args: '--no-deprecation',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '8012',
        HOST: '127.0.0.1',
      },
    },
  ],
};

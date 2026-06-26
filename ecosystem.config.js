module.exports = {
  apps: [{
    name: 'emmas-space',
    script: 'server.js',
    cwd: '/Users/toninichev/Applications/emmas-space',
    instances: 1,
    autorestart: true,
    watch: false,
    interpreter: '/opt/homebrew/bin/node',
    env: {
      NODE_ENV: 'production',
      PORT: 3006,
    },
  }, {
    name: 'right-now-scheduler',
    script: 'schedule_right_now.mjs',
    cwd: '/Users/toninichev/Applications/emmas-space',
    cron_restart: '0 0 * * *',
    autorestart: false,
    watch: false,
    interpreter: '/opt/homebrew/bin/node',
    env: { NODE_ENV: 'production' },
  }],
};

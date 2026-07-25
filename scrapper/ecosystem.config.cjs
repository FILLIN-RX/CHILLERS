module.exports = {
  apps: [{
    name: 'chiller-scraper',
    script: './dist/index.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
    },
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    kill_timeout: 30000,
    windowsHide: true,
  }],
};

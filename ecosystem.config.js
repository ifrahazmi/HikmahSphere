module.exports = {
  apps: [
    {
      name: 'hikmah-backend',
      script: 'dist/index.js',
      cwd: '/home/ifrahazmi/HikmahSphere/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      // Prevent rapid crash-loop restarts from hammering the system
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Log configuration
      error_file: '/home/ifrahazmi/.pm2/logs/hikmah-backend-error.log',
      out_file: '/home/ifrahazmi/.pm2/logs/hikmah-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};

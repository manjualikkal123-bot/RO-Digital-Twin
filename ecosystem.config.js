module.exports = {
  apps: [
    {
      name: "ro-backend",
      script: "server.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
      }
    },
    {
      name: "ro-frontend",
      script: "node_modules/vite/bin/vite.js",
      cwd: "./frontend",
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "ro-ml",
      script: "ml_server.py",
      interpreter: "./venv/Scripts/python.exe",
      watch: false,
      autorestart: true,
      max_restarts: 10,
    }
  ]
};

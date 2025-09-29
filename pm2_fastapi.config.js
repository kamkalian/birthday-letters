module.exports = {
  apps: [
    {
      name: "birthday-letters-api",
      script: "/home/ingrid/birthday-letters/.venv/bin/uvicorn",
      args: "fastapi.main:app --host 0.0.0.0 --port 8000",
      interpreter: "none",
      cwd: "/home/ingrid/birthday-letters",
      autorestart: true,
      env: {
        PORT: "8000"
      }
    }
  ]
};
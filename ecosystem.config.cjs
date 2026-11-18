/**
 * Configuración de PM2 para Sello Fiel.
 *
 * Se registra desde el PM2 de **root**, para que arranque solo cuando el
 * servidor se reinicie, igual que los demás sitios del VPS. Pero el proceso
 * corre como el usuario **claude**, y eso no es un detalle:
 *
 * La aplicación se conecta a PostgreSQL por socket Unix sin contraseña, y
 * PostgreSQL identifica al cliente por el usuario del sistema operativo. Si el
 * proceso corriera como root, intentaría entrar con el rol `root`, que no
 * existe, y fallaría toda lectura y escritura. De ahí el `uid`/`gid`.
 *
 * Registro (una sola vez, como root):
 *
 *   cd /home/claude/proyectos/fidelizacion
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * Despliegues posteriores:  npm run build && pm2 restart sellofiel
 */

module.exports = {
  apps: [
    {
      name: 'sellofiel',
      cwd: '/home/claude/proyectos/fidelizacion',
      script: 'npm',
      args: 'run start',

      // Imprescindible: ver la explicación de arriba.
      uid: 'claude',
      gid: 'claude',

      env: {
        NODE_ENV: 'production',
      },

      // Un solo proceso: la carga de unos pocos locales no justifica más, y
      // evita sorpresas con la cola de Google Wallet.
      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      max_restarts: 10,
      // Si se queda sin memoria, mejor reiniciar que arrastrar el problema.
      max_memory_restart: '400M',

      out_file: '/home/claude/logs/sellofiel-out.log',
      error_file: '/home/claude/logs/sellofiel-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};

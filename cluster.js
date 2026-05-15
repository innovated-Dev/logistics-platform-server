// ================================================================
// cluster.js — Multi-Core Production Entry Point
// ================================================================
// Node.js is single-threaded. This file uses the built-in cluster
// module to fork one worker per CPU core, so a 4-core server runs
// 4 independent Node processes, each handling its own requests.
//
// LOAD BALANCING:
//   Node's cluster module uses round-robin distribution (the default
//   on Linux/macOS) to spread incoming connections across workers.
//   Each worker is a full copy of server.js — they share no memory,
//   but they share the same TCP port.
//
// SOCKET.IO + REDIS ADAPTER:
//   Because workers share no memory, a Socket.IO event emitted in
//   worker A cannot reach a client connected to worker B unless we
//   use the Redis adapter. server.js attaches the Redis adapter when
//   REDIS_URL is set, which pub/subs events across all workers.
//   This is why Redis is mandatory for cluster mode in production.
//
// CRON JOBS:
//   Only the primary process (cluster.isPrimary) runs cron jobs,
//   preventing duplicate SMS/email sends from multiple workers.
//
// AUTO-RESTART:
//   If a worker crashes (unhandled exception, OOM, etc.), the primary
//   forks a replacement immediately, so the service stays alive.
// ================================================================
import cluster    from 'cluster';
import os         from 'os';
import 'dotenv/config';
import { validateEnv, env } from './src/config/env.js';

validateEnv();

const NUM_WORKERS = env.WORKERS || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`\n🚀  OffScape Cluster — Primary PID:${process.pid}`);
  console.log(`    Forking ${NUM_WORKERS} workers (${os.cpus()[0].model})`);
  console.log(`    Environment: ${env.NODE_ENV}\n`);

  // Fork one worker per CPU core
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = cluster.fork({ NODE_APP_INSTANCE: i });
    console.log(`    Worker ${i} forked — PID:${worker.process.pid}`);
  }

  // Replace crashed workers
  cluster.on('exit', (worker, code, signal) => {
    const reason = signal || `exit code ${code}`;
    console.error(`\n💀  Worker PID:${worker.process.pid} died (${reason}) — restarting...`);
    cluster.fork();
  });

  // Log when workers come online
  cluster.on('online', (worker) => {
    console.log(`✅  Worker PID:${worker.process.pid} is online`);
  });

  // Graceful cluster shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received — shutting down cluster');
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 10000);
  });

} else {
  // Worker processes: each runs a full server.js instance
  await import('./server.js');
}
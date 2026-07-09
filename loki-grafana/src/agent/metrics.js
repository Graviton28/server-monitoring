import os from "os";
import si from "systeminformation";
import { execSync } from "child_process";

export async function collectMetrics(pm2AppName) {
  const load = await si.currentLoad();
  const restarts = pm2AppName ? getPm2Restarts(pm2AppName) : null;

  return {
    host: os.hostname(),
    uptime_s: os.uptime(),
    load_pct: Math.round(load.currentLoad * 10) / 10,
    load1: os.loadavg()[0],
    status: "ok",
    last_crash_s_ago: restarts ? Math.round((Date.now() - restarts.lastCrashAt) / 1000) : null,
    crash_count: restarts ? restarts.count : null,
  };
}

function getPm2Restarts(appName) {
  try {
    const list = JSON.parse(execSync("pm2 jlist").toString());
    const proc = list.find((p) => p.name === appName);
    if (!proc) return null;
    return {
      count: proc.pm2_env.restart_time,
      lastCrashAt: proc.pm2_env.pm_uptime,
    };
  } catch {
    return null;
  }
}

// Runs ON the monitored server. Collects local metrics and pushes them to Loki
// on a timer. No inbound port is opened; this only makes outbound requests.
import "dotenv/config";
import { collectMetrics } from "./metrics.js";
import { pushToLoki } from "../loki.js";

const INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 15000;
const PM2_APP_NAME = process.env.PM2_APP_NAME || null;

async function tick() {
  const metrics = await collectMetrics(PM2_APP_NAME);
  await pushToLoki(
    { job: "server-monitor-agent", host: metrics.host, env: process.env.ENV_LABEL || "prod" },
    metrics
  );
}

tick();
setInterval(tick, INTERVAL_MS);

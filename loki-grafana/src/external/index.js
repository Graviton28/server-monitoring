// Agentless mode: run this ONE place (not on the monitored servers). It reaches
// out to each target over TCP/HTTP and records reachability + latency to Loki.
// Nothing is installed on the targets; a target only needs to be reachable on
// the given port/URL.
import "dotenv/config";
import { readFileSync } from "fs";
import { checkTcp, checkHttp } from "./checks.js";
import { pushToLoki } from "../loki.js";

const INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 60000;
const FAILURE_THRESHOLD = Number(process.env.FAILURE_THRESHOLD) || 3;
const TARGETS_FILE = process.env.TARGETS_FILE || "./config/targets.json";

const targets = JSON.parse(readFileSync(TARGETS_FILE, "utf8"));
const failureCounts = new Map();

async function checkTarget(target) {
  const result =
    target.type === "http" ? await checkHttp(target.url) : await checkTcp(target.host, target.port);

  const prevFailures = failureCounts.get(target.name) || 0;
  const failures = result.up ? 0 : prevFailures + 1;
  failureCounts.set(target.name, failures);

  const status = failures >= FAILURE_THRESHOLD ? "down" : "ok";

  await pushToLoki(
    { job: "server-monitor-external", host: target.name, env: process.env.ENV_LABEL || "prod" },
    { ...result, status, consecutive_failures: failures }
  );
}

async function tick() {
  await Promise.all(targets.map(checkTarget));
}

tick();
setInterval(tick, INTERVAL_MS);

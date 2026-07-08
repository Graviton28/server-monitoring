# server-monitoring

Pushes server health data to [Loki](https://grafana.com/oss/loki/) so it can be viewed in an existing Grafana dashboard. Two independent modes, pick whichever fits a given server:

- **`agent`** — installed and run *on* a server you control. Reads real local metrics (uptime, CPU load, crash/restart history) and pushes them out. Requires the server owner to be okay with something running on their machine.
- **`external`** — run from *one central place*, checks other servers over the network (TCP connect / HTTP request) without installing anything on them. Only tells you reachability + latency, not internal metrics like CPU load.

Both modes only make **outbound** requests to Loki. Neither opens a listening port, so no inbound firewall changes are needed on the machine running either script.

## Setup

```bash
npm install
cp .env.example .env   # fill in LOKI_URL and auth
```

Ask whoever runs your Loki instance for:
- the push URL (`LOKI_URL`, the script POSTs to `${LOKI_URL}/loki/api/v1/push`)
- how it's authenticated — Basic auth (`LOKI_USER` + `LOKI_API_KEY`, e.g. Grafana Cloud) or `LOKI_ORG_ID` (self-hosted multi-tenant Loki). Leave both blank only if you've confirmed the endpoint has no auth — see the security note below.

## Agent mode

Run directly on the server being monitored:

```bash
npm run agent
```

Keep it alive across reboots/crashes with `pm2` or `systemd` rather than running it in a plain terminal:

```bash
pm2 start src/agent/index.js --name server-monitor
```

If the thing you actually care about is a specific app's crash history (not just the machine rebooting), set `PM2_APP_NAME` in `.env` to that app's pm2 process name — the agent will read its restart count and last-start time from `pm2 jlist`.

## External (agentless) mode

Run from one central machine (not the servers being checked):

```bash
cp config/targets.example.json config/targets.json   # edit with real hosts
npm run external
```

`config/targets.json` is gitignored since it'll contain real hostnames/IPs — edit your own copy locally. Each entry is either:

```json
{ "name": "web-01", "type": "tcp", "host": "203.0.113.10", "port": 443 }
{ "name": "web-02", "type": "http", "url": "https://example.com/health" }
```

A target is only marked `"down"` after `FAILURE_THRESHOLD` consecutive failed checks (default 3), to avoid flagging single dropped-packet blips as outages.

## Viewing it in Grafana

Data lands as JSON log lines under labels `job` (`server-monitor-agent` or `server-monitor-external`), `host`, and `env`. In Grafana's Explore view against the Loki data source:

```logql
# raw events for one host
{job="server-monitor-agent", host="web-01"} | json

# CPU load over time as a graph
avg_over_time({job="server-monitor-agent", host="web-01"} | json | unwrap load1 [1m])

# latest uptime as a stat panel
last_over_time({job="server-monitor-agent", host="web-01"} | json | unwrap uptime_s [5m])

# external reachability status
{job="server-monitor-external"} | json | status="down"
```

## Security note

The Loki push endpoint should **not** sit open on the internet without auth — an unauthenticated ingestion endpoint can be found and abused (spammed with junk to run up ingestion costs, or used to push fake "status: ok" data to mask a real problem). Before pointing this at a real Loki instance, confirm with whoever runs it that:

- the endpoint requires auth (Basic auth or `X-Scope-OrgID` + tenant auth), and/or
- it's only reachable over a private network/VPN, not the public internet, and
- ingestion rate limits are configured so a misbehaving or leaked-key client can't unbounded fill storage.

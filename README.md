# server-monitoring

Two independent server-monitoring setups live in this repo:

- **Loki/Grafana push agent** (below) — a Node project pushing health data to [Loki](https://grafana.com/oss/loki/) for viewing in Grafana.
- **[`bash-scripts/`](#bash-scripts-agentless-cron-monitoring)** — an older, already-running-in-production cron setup on one desktop. Fully independent of the Loki project; see its section below.

## Loki/Grafana push agent

Pushes server health data to Loki so it can be viewed in an existing Grafana dashboard. Two independent modes, pick whichever fits a given server:

- **`agent`** — installed and run *on* a server you control. Reads real local metrics (uptime, CPU load, crash/restart history) and pushes them out. Requires the server owner to be okay with something running on their machine.
- **`external`** — run from *one central place*, checks other servers over the network (TCP connect / HTTP request) without installing anything on them. Only tells you reachability + latency, not internal metrics like CPU load.

Both modes only make **outbound** requests to Loki. Neither opens a listening port, so no inbound firewall changes are needed on the machine running either script.

### Setup

```bash
npm install
cp .env.example .env   # fill in LOKI_URL and auth
```

For agent mode specifically, see [INSTALL.txt](./INSTALL.txt) for a one-line install command to run directly on a server.

Ask whoever runs your Loki instance for:
- the push URL (`LOKI_URL`, the script POSTs to `${LOKI_URL}/loki/api/v1/push`)
- how it's authenticated — Basic auth (`LOKI_USER` + `LOKI_API_KEY`, e.g. Grafana Cloud) or `LOKI_ORG_ID` (self-hosted multi-tenant Loki). Leave both blank only if you've confirmed the endpoint has no auth — see the security note below.

### Agent mode

Run directly on the server being monitored:

```bash
npm run agent
```

Keep it alive across reboots/crashes with `pm2` or `systemd` rather than running it in a plain terminal:

```bash
pm2 start src/agent/index.js --name server-monitor
```

If the thing you actually care about is a specific app's crash history (not just the machine rebooting), set `PM2_APP_NAME` in `.env` to that app's pm2 process name — the agent will read its restart count and last-start time from `pm2 jlist`.

### External (agentless) mode

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

### Viewing it in Grafana

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

### Security note

The Loki push endpoint should **not** sit open on the internet without auth — an unauthenticated ingestion endpoint can be found and abused (spammed with junk to run up ingestion costs, or used to push fake "status: ok" data to mask a real problem). Before pointing this at a real Loki instance, confirm with whoever runs it that:

- the endpoint requires auth (Basic auth or `X-Scope-OrgID` + tenant auth), and/or
- it's only reachable over a private network/VPN, not the public internet, and
- ingestion rate limits are configured so a misbehaving or leaked-key client can't unbounded fill storage.

## bash-scripts: agentless cron monitoring

Agentless monitoring running from cron on one desktop (`freakyipa01`, user `researchtech`). Predates the Loki/Grafana project above and is fully independent of it. Just SSH/TCP checks from one central place, no installs on the servers being watched. Scripts live under [`bash-scripts/`](./bash-scripts/).

Config (gitignored, real data stays on the server — see the `.example` file for format):

- **`systems`** — `host|name|dept|owner|user`. `user`: blank = default SSH user, a name overrides it, `WIP` = no working SSH access yet (skipped by `narc`).
- **`emails`** — recipients for the morning report, one per line.
- **`snitch_targets`** — `host|name|ports` (comma-separated) for CARC infrastructure. See [`bash-scripts/snitch_targets.example`](./bash-scripts/snitch_targets.example).

### Scripts

- **`sshello`** — TCP-connects to port 22 on everything in `systems`, prints up/down + dept/owner. No SSH key needed. `down` arg to only print failures.
- **`snitch`** (v1.3) — same, for CARC's own boxes (Hopper, Hopper-io, Hopper-sn, Easley, freeipa01/02, Coldfront, Mokey), checking the actual ports each one runs (NFS, web, rpcbind), from `snitch_targets`.
- **`narc`** (v1.2) — deeper diagnostics over SSH (needs a key first, skips `WIP` hosts): OS, uptime, load, memory, disk, last reboot, top processes, failed services.
- **`sshello_email.sh`** — daily report: `snitch` + `sshello` inline, plus a fresh `narc` run logged to `narc_logs/` and attached to the email.

### Cron

```
30 7 * * 1-5   sshello_email.sh                          # weekday mornings, 7:30am
5  *  * * *    sshello -> sshello_logs/sshello.log        # hourly, rotated weekly
10 *  * * *    narc -> narc_logs/narc-log-<timestamp>.log  # hourly, fresh file every run
               (both log dirs cleaned out after 60 days)
```

### Adding a host or email recipient

```bash
# add a new system (host|name|dept|owner)
echo "newhost.unm.edu|NewHost|Dept|Owner Name" >> systems

# add a new email recipient
echo "someone@unm.edu" >> emails

# add a new CARC host for snitch to check (host|name|ports)
echo "newhost.alliance.unm.edu|NewHost|22,80,443" >> snitch_targets
```

`sshello` and `snitch` both pick up new entries automatically on their next run. For `narc` to reach a new host: `ssh-copy-id <host>` (or `ssh-copy-id user@host` if it needs a non-default account — tag it `WIP` in `systems` until that's sorted).

### Planned features

- **Loki/Grafana dashboard** — right now `narc`'s hourly runs just sit in `narc_logs/` as flat files. The plan is to feed that same data into the Loki setup above, so uptime/load/mem/disk/failed-services show up on a live Grafana dashboard instead of something you have to open a log file to check. Likely approach: either point a log-shipping agent (e.g. promtail) at `narc_logs/`, or have `narc` push structured data straight to Loki's push API after each run — similar to `src/agent` above, just triggered by cron instead of running as a persistent process.
- **Resolving remaining `WIP` hosts** — Hopper\*, Easley\*, Coldfront, Mokey, CMB, and Nebula need SSH access as the `astech` user rather than `researchtech`; the three LOBO boxes (`CASLMSQLSQLP01`, `CARCLRSCHAPPP01`, `CARCLRSCHAPPP44`) need credentials tracked down entirely. Once access exists, flip the `systems` entry from `WIP` to the right value (or leave it blank) and `narc` picks the host up on its next run.

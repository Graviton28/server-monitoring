# bash-scripts

A pre-existing, agentless monitoring setup that runs entirely from cron on one desktop (`freakyipa01`, as user `researchtech`). It predates the Loki/Grafana project in the rest of this repo and serves a different need: nothing gets installed on the servers being watched, which matters because some server owners don't want monitoring software on their machines. Everything here is plain SSH and TCP connect checks.

All scripts read from two local, gitignored files (real data never leaves the server):

- **`systems`** — pipe-delimited `host|name|dept|owner`, one line per server. The single source of truth for which hosts get checked and who owns them.
- **`emails`** — one address per line, who gets the morning report.

## Files

- **`sshello`** — walks `systems`, TCP-connects to port 22 on each host, prints `up`/`down` plus dept/owner. Doesn't need SSH keys, just an open port — the lowest-friction check for servers CARC doesn't administer. Accepts an optional `down` argument to print only the failures.
- **`snitch`** — same idea as `sshello` but for CARC's own infrastructure (Hopper, Easley, freeipa, Coldfront, Mokey), where the relevant port depends on the service each host actually runs (NFS, web, rpcbind, etc.), not just port 22. Reports one up/down line per host, down if *any* of its ports fail.
- **`narc`** — the deeper check, requires passwordless SSH key auth to each host in `systems` (`BatchMode=yes`, so it fails closed rather than hanging on a password prompt). Per host: OS, uptime, load average, memory, disk usage on `/`, last reboot time, top 3 CPU processes, and any failed systemd services. This is also what's building a data backlog for the eventual Loki/Grafana dashboard.
- **`sshello_email.sh`** — the daily report. Runs `snitch` + `sshello` inline in the email body, then runs its own fresh copy of `narc` (independent of the hourly cron run below), logs that run, and attaches it to the email as a file rather than inlining it (keeps the body readable while still keeping the full per-host detail).

## Why login-less checks where possible

`sshello`/`snitch` intentionally avoid SSH entirely — a bare TCP connect check works even on servers CARC has no account on, which covers most of the department-owned machines in `systems`. `narc` is the exception: failed-service and resource-usage detail can only come from actually logging in, so it's restricted to hosts where a key has been set up.

## Cron layout

```
30 7 * * 1-5   sshello_email.sh            # daily report + narc attachment, weekdays 7:30am
5  *  * * *    sshello >> sshello_logs/sshello.log       # hourly, one growing file
0  0  * * 0    rotate sshello.log weekly
0  1  * * *    delete sshello_logs/*.log.* older than 60 days
10 *  * * *    narc > narc_logs/narc_<timestamp>.log      # hourly, new file every run
0  1  * * *    delete narc_logs/*.log older than 60 days
```

`sshello.log` is appended-and-rotated (one continuous timeline); `narc` writes a fresh timestamped file per run instead, since each run is already split into per-host sections and there's nothing to usefully rotate within a single run's output.

## Setup on a new box

1. Populate `systems` and `emails` (see format above) — not committed here, keep your own copy on the server.
2. For `narc`, set up a key and copy it to every host in `systems`:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
   while IFS='|' read -r host name dept owner; do
   	[ -z "$host" ] && continue
   	case "$host" in \#*) continue ;; esac
   	ssh-copy-id "$host"
   done < systems
   ```
3. `chmod +x` each script, drop the cron layout above into `crontab -e` (adjusting the absolute paths to wherever these scripts actually live).

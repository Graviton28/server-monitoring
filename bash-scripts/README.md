# bash-scripts

Old-school agentless monitoring, running from cron on one desktop (`freakyipa01`, user `researchtech`). Predates the Loki/Grafana stuff elsewhere in this repo. No agents, no installs on the servers being watched — some owners don't want monitoring software on their boxes, so it's just SSH/TCP checks from one central place.

Two gitignored files hold the config (real data stays on the server, never in this repo):

- **`systems`** — `host|name|dept|owner`, one line per server.
- **`emails`** — who gets the morning report, one address per line.

## Scripts

- **`sshello`** — TCP-connects to port 22 on everything in `systems`, prints up/down + owner. No SSH key needed. Pass `down` as an arg to only print failures.
- **`snitch`** — same idea, but for CARC's own boxes (Hopper, Easley, freeipa, Coldfront, Mokey), checking whatever ports each one actually runs, not just 22.
- **`narc`** — the real diagnostics. Needs an SSH key set up on each host first. Grabs OS, uptime, load, memory, disk, last reboot, top processes, and failed services. Doubles as the data feed for the future Loki/Grafana dashboard.
- **`sshello_email.sh`** — the daily report: `snitch` + `sshello` in the email body, plus a fresh `narc` run attached as a log file.

## Cron

```
30 7 * * 1-5   sshello_email.sh                      # weekday mornings, 7:30am
5  *  * * *    sshello -> sshello_logs/sshello.log    # hourly, rotated weekly
10 *  * * *    narc -> narc_logs/narc_<timestamp>.log  # hourly, fresh file every run
               (both log dirs cleaned out after 60 days)
```

## Adding a host

1. Add a line to `systems`.
2. `sshello` picks it up automatically. `snitch`'s CARC list is hardcoded, so add CARC boxes there directly.
3. For `narc` to reach it: `ssh-copy-id <host>`.

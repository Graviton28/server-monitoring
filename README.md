# server-monitoring

Server monitoring using cron and bash scripts. Just SSH/TCP checks from one central place. Scripts available under [`bash-scripts/`](./bash-scripts/).

## Config
Config files format

- **`systems`** — `host|name|dept|owner|user`. `user`: blank = default SSH user, a name overrides it, `WIP` = no working SSH access yet (skipped by `narc`).
- **`emails`** — recipients for the morning report, one per line.
- **`snitch_targets`** — `host|name|ports` (comma-separated) for CARC infrastructure. See [`bash-scripts/snitch_targets.example`](./bash-scripts/snitch_targets.example).

## Scripts

- **`sshello`** — TCP-connects to port 22 on everything in `systems`, prints up/down + dept/owner. `down` arg to only print failures.
- **`snitch`** (v1.3) — same for CARC's own systems, checking the actual ports from `snitch_targets`.
- **`narc`** (v1.2) — deeper diagnostics over SSH: OS, uptime, load, memory, disk, last reboot, top processes, failed services.
- **`sshello_email.sh`** — daily report: `snitch` + `sshello` inline, plus a fresh `narc` run logged to `narc_logs/` and attached to the email.

## Cron

```
30 7 * * 1-5   sshello_email.sh                          # weekday mornings, 7:30am
5  *  * * *    sshello -> sshello_logs/sshello.log        # hourly, rotated weekly
10 *  * * *    narc -> narc_logs/narc-log-<timestamp>.log  # hourly, fresh file every run
               (both log dirs cleaned out after 60 days)
```

## Adding a host or email recipient

```bash
# add a new system (host|name|dept|owner)
echo "newhost.unm.edu|NewHost|Dept|Owner Name" >> systems

# add a new email recipient
echo "someone@unm.edu" >> emails

# add a new CARC host for snitch to check (host|name|ports)
echo "newhost.alliance.unm.edu|NewHost|22,80,443" >> snitch_targets
```

`sshello` and `snitch` both pick up new entries automatically on their next run. For `narc` to reach a new host: `ssh-copy-id <host>` (or `ssh-copy-id user@host` if it needs a non-default account — tag it `WIP` in `systems` until that's sorted).

## Planned features

- **Loki/Grafana dashboard** — push `narc`'s data to Loki and display it on a Grafana dashboard, instead of it just sitting in `narc_logs/` as flat files.

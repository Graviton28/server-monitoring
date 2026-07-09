# bash-scripts

Old-school agentless monitoring, running from cron on one desktop (`freakyipa01`, user `researchtech`). Predates the Loki/Grafana stuff elsewhere in this repo. No agents, no installs on the servers being watched — some owners don't want monitoring software on their boxes, so it's just SSH/TCP checks from one central place.

Three gitignored files hold the config (real data stays on the server, never in this repo — see the `.example` version of each for the format):

- **`systems`** — `host|name|dept|owner|user`, one line per server. `user` is optional: blank means SSH as the default user, a real name overrides it (some hosts use a different account than `researchtech`), and `WIP` means "known but no working SSH access yet" — `narc` and the key-setup loop both skip those cleanly instead of failing.
- **`emails`** — who gets the morning report, one address per line.
- **`snitch_targets`** — `host|name|ports` (comma-separated), CARC's own infrastructure and whichever ports each one actually runs. See [`snitch_targets.example`](./snitch_targets.example) for the format.

## Scripts

- **`sshello`** — TCP-connects to port 22 on everything in `systems`, prints up/down + dept/owner. No SSH key needed. Pass `down` as an arg to only print failures. (Used to be two scripts, `sshello` and `sshello_down`; merged into one.)
- **`snitch`** (v1.3) — same idea, but for CARC's own boxes (Hopper, Hopper-io, Hopper-sn, Easley, freeipa01/02, Coldfront, Mokey), reading host/ports from `snitch_targets` since each one runs different services (NFS, web, rpcbind, etc.), not just 22.
- **`narc`** (v1.2) — the real diagnostics, absorbed what used to be a separate `narc_stats` script. Needs an SSH key set up on each host first (skips anything tagged `WIP`, and connects as the right user when `systems` specifies one). Grabs OS, uptime, load, memory, disk, last reboot, top processes, and failed services, one section per host.
- **`sshello_email.sh`** — the daily report: `snitch` + `sshello` output inline in the email body, plus an independent, freshly-run copy of `narc` (separate from the hourly cron run) logged to `narc_logs/` and attached to the email as a file.

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

- **Loki/Grafana dashboard** — right now `narc`'s hourly runs just sit in `narc_logs/` as flat files. The plan is to feed that same data into a Loki setup, so uptime/load/mem/disk/failed-services show up on a live Grafana dashboard instead of something you have to open a log file to check. Likely approach: either point a log-shipping agent (e.g. promtail) at `narc_logs/`, or have `narc` push structured data straight to Loki's push API after each run.
- **Resolving remaining `WIP` hosts** — Hopper\*, Easley\*, Coldfront, Mokey, CMB, and Nebula need SSH access as the `astech` user rather than `researchtech`; the three LOBO boxes (`CASLMSQLSQLP01`, `CARCLRSCHAPPP01`, `CARCLRSCHAPPP44`) need credentials tracked down entirely. Once access exists, flip the `systems` entry from `WIP` to the right value (or leave it blank) and `narc` picks the host up on its next run.

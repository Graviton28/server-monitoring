#!/bin/bash
#Updated by Henry Fricke on 7/9/2026

to_list=$(paste -sd',' /home/researchtech/server_monitoring_scripts/emails)
boundary="NARC-$(date +%s)"

narc_output=$(/home/researchtech/server_monitoring_scripts/narc)
log_file="/home/researchtech/server_monitoring_scripts/narc_logs/narc-log-$(date +%Y%m%d_%H%M).log"
echo "$narc_output" > "$log_file"
log_name=$(basename "$log_file")

{
	echo "To:${to_list}"
	echo "From: jcrowley1@unm.edu"
	echo "Subject: Arts and Science Server SSH Status"
	echo "MIME-Version: 1.0"
	echo "Content-Type: multipart/mixed; boundary=\"$boundary\""
	echo
	echo "--$boundary"
	echo "Content-Type: text/plain; charset=UTF-8"
	echo
	echo "CARC systems:"
	/home/researchtech/server_monitoring_scripts/snitch
	echo
	echo "Remote systems:"
	/home/researchtech/server_monitoring_scripts/sshello
	echo
	echo "Local server uptime:"
	uptime -p
	echo
	echo "--$boundary"
	echo "Content-Type: text/plain; name=\"$log_name\""
	echo "Content-Disposition: attachment; filename=\"$log_name\""
	echo "Content-Transfer-Encoding: base64"
	echo
	echo "$narc_output" | base64
	echo
	echo "--$boundary--"
} | /usr/sbin/sendmail -t

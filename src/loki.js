// Shared push helper used by both the agent and external checkers.
export async function pushToLoki(labels, fields) {
  const nowNs = (Date.now() * 1e6).toString();
  const line = JSON.stringify(fields);

  const body = {
    streams: [
      {
        stream: labels,
        values: [[nowNs, line]],
      },
    ],
  };

  const headers = { "Content-Type": "application/json" };
  if (process.env.LOKI_USER && process.env.LOKI_API_KEY) {
    headers.Authorization =
      "Basic " + Buffer.from(`${process.env.LOKI_USER}:${process.env.LOKI_API_KEY}`).toString("base64");
  }
  if (process.env.LOKI_ORG_ID) {
    headers["X-Scope-OrgID"] = process.env.LOKI_ORG_ID;
  }

  const res = await fetch(`${process.env.LOKI_URL}/loki/api/v1/push`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Loki push failed (${res.status}):`, await res.text());
  }
}

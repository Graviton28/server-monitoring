import net from "net";

export function checkTcp(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const start = Date.now();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve({ up: true, latency_ms: Date.now() - start });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ up: false, reason: "timeout" });
    });
    socket.once("error", () => {
      resolve({ up: false, reason: "refused/unreachable" });
    });
    socket.connect(port, host);
  });
}

export async function checkHttp(url, timeoutMs = 5000) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { up: res.ok, status: res.status, latency_ms: Date.now() - start };
  } catch (e) {
    return { up: false, reason: e.message };
  }
}

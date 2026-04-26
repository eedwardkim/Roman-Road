import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import WebSocket from "ws";

export const runtime = "nodejs";

const BRIDGE_HOST = "127.0.0.1";
const BRIDGE_PORT = 8765;
const BRIDGE_READY_TIMEOUT_MS = 2500;

declare global {
  var keymaxxCaptureProcess: ChildProcess | undefined;
  var keymaxxBridgeProcess: ChildProcess | undefined;
}

function isRunning(processRef: ChildProcess | undefined) {
  return Boolean(processRef && processRef.exitCode === null && !processRef.killed);
}

function isBridgeListening() {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: BRIDGE_HOST, port: BRIDGE_PORT });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForBridgeListening(timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBridgeListening()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

function clearProcessRef(
  processRef: ChildProcess | undefined,
  key: "keymaxxCaptureProcess" | "keymaxxBridgeProcess"
) {
  if (globalThis[key] === processRef) {
    globalThis[key] = undefined;
  }
}

function stopProcess(processRef: ChildProcess | undefined) {
  if (!processRef || !isRunning(processRef)) return;

  try {
    processRef.kill();
  } catch {
    /* ignore */
  }
}

function getBridgeProducerStatus() {
  return new Promise<boolean | null>((resolve) => {
    let settled = false;
    const ws = new WebSocket(`ws://${BRIDGE_HOST}:${BRIDGE_PORT}`);

    const finish = (result: boolean | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timeout = setTimeout(() => finish(null), 500);

    ws.once("open", () => {
      ws.send(JSON.stringify({ type: "hello", role: "subscriber" }));
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; connected?: boolean };
        if (msg.type === "producer_status" && typeof msg.connected === "boolean") {
          finish(msg.connected);
        }
      } catch {
        finish(null);
      }
    });

    ws.once("error", () => finish(null));
    ws.once("close", () => finish(null));
  });
}

export async function POST() {
  let bridgeListening = await isBridgeListening();

  if (isRunning(globalThis.keymaxxBridgeProcess) && !bridgeListening) {
    stopProcess(globalThis.keymaxxBridgeProcess);
    globalThis.keymaxxBridgeProcess = undefined;
  }

  if (!isRunning(globalThis.keymaxxBridgeProcess) && !bridgeListening) {
    const bridgeProcess = spawn("node", ["ws-bridge/server.js"], {
      cwd: process.cwd(),
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        KEYMAXX_WS_HOST: BRIDGE_HOST,
        KEYMAXX_WS_PORT: String(BRIDGE_PORT),
      },
    });

    globalThis.keymaxxBridgeProcess = bridgeProcess;

    bridgeProcess.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });

    bridgeProcess.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    bridgeProcess.on("exit", () => {
      clearProcessRef(bridgeProcess, "keymaxxBridgeProcess");
    });

    bridgeListening = await waitForBridgeListening(BRIDGE_READY_TIMEOUT_MS);
  }

  if (!bridgeListening) {
    return Response.json(
      { ok: false, error: "System capture bridge failed to start on ws://127.0.0.1:8765." },
      { status: 500 }
    );
  }

  if (bridgeListening) {
    const producerConnected = await getBridgeProducerStatus();
    if (producerConnected === null) {
      return Response.json(
        { ok: false, error: "A WebSocket server is running on port 8765, but it is not the Bi-grammar capture bridge. Restart the bridge and try again." },
        { status: 409 }
      );
    }
    if (producerConnected) {
      return Response.json({ ok: true, alreadyRunning: true });
    }
  }

  if (isRunning(globalThis.keymaxxCaptureProcess)) {
    return Response.json({ ok: true, alreadyRunning: true });
  }

  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, "scripts", "keymaxx_capture.py");
  const captureProcess = spawn("python3", [scriptPath], {
    cwd: projectRoot,
    detached: false,
    stdio: ["ignore", "ignore", "pipe"],
    env: process.env,
  });

  globalThis.keymaxxCaptureProcess = captureProcess;

  captureProcess.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  captureProcess.on("exit", () => {
    clearProcessRef(captureProcess, "keymaxxCaptureProcess");
  });

  return Response.json({ ok: true, alreadyRunning: false });
}

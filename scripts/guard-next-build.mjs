#!/usr/bin/env node

import { createConnection } from "node:net";
import { pathToFileURL } from "node:url";

export const DEFAULT_NEXT_DEV_HOST = "127.0.0.1";
export const DEFAULT_NEXT_DEV_PORT = 3000;
const CONNECT_TIMEOUT_MS = 300;

export async function assertNextBuildSafe({
  environment = process.env,
  host = environment.NEXT_DEV_HOST ?? DEFAULT_NEXT_DEV_HOST,
  port = normalizePort(environment.NEXT_DEV_PORT ?? DEFAULT_NEXT_DEV_PORT),
  isPortOpen = isTcpPortOpen,
} = {}) {
  if (await isPortOpen({ host, port })) {
    throw new Error(
      `Refusing Next build while ${host}:${port} is in use. next dev and next build share .next and a concurrent build can corrupt the running dev server. Stop the dev server before building, then restart with npm run dev:preview.`,
    );
  }

  return { status: "clear", host, port };
}

export function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`NEXT_DEV_PORT must be an integer from 1 to 65535; received ${value}.`);
  }
  return port;
}

export function isTcpPortOpen({ host, port, timeoutMs = CONNECT_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;

    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  try {
    await assertNextBuildSafe();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

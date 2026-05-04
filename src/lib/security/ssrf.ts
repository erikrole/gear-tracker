import { lookup } from "node:dns/promises";

/**
 * Reject URLs whose hostname resolves to a private, loopback, link-local,
 * CGNAT, or otherwise non-routable address. Done post-DNS so attackers
 * can't bypass with a public DNS record pointing at 127.0.0.1 (or AWS
 * metadata at 169.254.169.254, etc.).
 *
 * Throws a generic Error on rejection — callers wrap it in HttpError.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const { address, family } = await lookup(hostname);
  const isPrivate =
    family === 4
      ? isPrivateIPv4(address)
      : family === 6
        ? isPrivateIPv6(address)
        : true;
  if (isPrivate) {
    throw new Error(`Host ${hostname} resolves to a private or non-routable address (${address}).`);
  }
}

function isPrivateIPv4(addr: string): boolean {
  const o = addr.split(".").map((n) => Number(n));
  if (o.length !== 4 || o.some((n) => Number.isNaN(n))) return true;
  const [a, b] = o;
  return (
    a === 0 ||                            // 0.0.0.0/8
    a === 10 ||                           // 10/8
    a === 127 ||                          // loopback
    (a === 169 && b === 254) ||           // link-local (incl. AWS metadata 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) ||           // 192.168/16
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    a >= 224                              // multicast + reserved
  );
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped — re-check the v4 portion
    const v4 = lower.slice("::ffff:".length);
    return isPrivateIPv4(v4);
  }
  return false;
}

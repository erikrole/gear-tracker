import { randomHex } from "@/lib/crypto";

export const ASSET_QR_CODE_LENGTH = 8;
const ASSET_QR_CODE_BYTES = ASSET_QR_CODE_LENGTH / 2;

export function generateAssetQrCode(): string {
  return randomHex(ASSET_QR_CODE_BYTES).toUpperCase();
}

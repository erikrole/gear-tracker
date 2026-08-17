import { describe, expect, it } from "vitest";
import { createStoredZip, type StoredZipEntry } from "@/lib/signatures/zip";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_FILENAME_FLAG = 0x0800;

function readStoredZipEntries(buffer: Buffer) {
  const entries: Array<{ name: string; data: Buffer }> = [];
  let offset = 0;

  while (offset + 4 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === END_OF_CENTRAL_DIRECTORY || signature === CENTRAL_DIRECTORY_HEADER) break;
    if (signature !== LOCAL_FILE_HEADER) {
      throw new Error(`Unexpected ZIP signature 0x${signature.toString(16)} at offset ${offset}`);
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const crc = buffer.readUInt32LE(offset + 14);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.toString("utf8", nameStart, nameStart + nameLength);
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    expect(compressionMethod).toBe(0);
    expect(compressedSize).toBe(uncompressedSize);
    expect(crc).toBe(crc32(data));

    entries.push({ name, data: Buffer.from(data) });
    offset = dataStart + compressedSize;
  }

  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(endOffset).toBeGreaterThanOrEqual(0);
  expect(buffer.readUInt32LE(endOffset)).toBe(END_OF_CENTRAL_DIRECTORY);
  expect(buffer.readUInt16LE(endOffset + 8)).toBe(entries.length);
  expect(buffer.readUInt16LE(endOffset + 10)).toBe(entries.length);

  return entries;
}

function crc32(data: Buffer | Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

describe("createStoredZip", () => {
  it("builds an empty archive with valid end-of-central-directory metadata", () => {
    const zip = createStoredZip([]);
    expect(zip.subarray(0, 4).readUInt32LE(0)).toBe(END_OF_CENTRAL_DIRECTORY);
    expect(readStoredZipEntries(zip)).toEqual([]);
  });

  it("stores one entry without compression and preserves bytes", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
    const zip = createStoredZip([{ name: "jose-role-signature.svg", data: svg }]);
    const entries = readStoredZipEntries(zip);

    expect(entries).toEqual([{ name: "jose-role-signature.svg", data: svg }]);
    expect(zip.subarray(0, 4).readUInt32LE(0)).toBe(LOCAL_FILE_HEADER);
    expect(zip.readUInt16LE(6)).toBe(UTF8_FILENAME_FLAG);
  });

  it("keeps multiple entries readable in archive order", () => {
    const entries: StoredZipEntry[] = [
      { name: "one.svg", data: Buffer.from("<svg>1</svg>") },
      { name: "two.svg", data: Buffer.from("<svg>2</svg>") },
      { name: "nested/three.svg", data: Buffer.from("<svg>3</svg>") },
    ];
    const zip = createStoredZip(entries);

    expect(readStoredZipEntries(zip)).toEqual(entries.map((entry) => ({
      name: entry.name,
      data: Buffer.from(entry.data),
    })));
  });

  it("supports UTF-8 filenames", () => {
    const zip = createStoredZip([
      { name: "josé-garcía-signature.svg", data: Buffer.from("<svg />") },
    ]);

    expect(readStoredZipEntries(zip)).toEqual([
      { name: "josé-garcía-signature.svg", data: Buffer.from("<svg />") },
    ]);
    expect(zip.readUInt16LE(6)).toBe(UTF8_FILENAME_FLAG);
  });

  it("rejects entry names that exceed the ZIP filename limit", () => {
    const longName = `${"a".repeat(0xffff)}.svg`;
    expect(() => createStoredZip([{ name: longName, data: Buffer.from("<svg />") }]))
      .toThrow("ZIP entry name is too long");
  });
});

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { decryptSoftwareSecret, encryptSoftwareSecret } from "@/lib/software-vault-crypto";

const softwareCredentialSelect = {
  id: true,
  name: true,
  category: true,
  websiteUrl: true,
  accountEmailCiphertext: true,
  passwordCiphertext: true,
  archivedAt: true,
  updatedAt: true,
} as const;

type SoftwareCredentialRow = {
  id: string;
  name: string;
  category: string | null;
  websiteUrl: string | null;
  accountEmailCiphertext: string;
  passwordCiphertext: string;
  archivedAt: Date | null;
  updatedAt: Date;
};

export type SoftwareCredentialSummary = {
  id: string;
  name: string;
  category: string | null;
  websiteUrl: string | null;
  accountEmail: string;
  hasPassword: boolean;
  archivedAt: string | null;
  updatedAt: string;
};

function toSummary(row: SoftwareCredentialRow): SoftwareCredentialSummary {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    websiteUrl: row.websiteUrl,
    accountEmail: decryptSoftwareSecret(row.accountEmailCiphertext),
    hasPassword: Boolean(row.passwordCiphertext),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSoftwareCredentials(includeArchived = false) {
  const rows = await db.softwareCredential.findMany({
    where: includeArchived ? undefined : { archivedAt: null },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    select: softwareCredentialSelect,
  });
  return rows.map((row) => toSummary(row));
}

export async function createSoftwareCredential(data: {
  name: string;
  category?: string | null;
  websiteUrl?: string | null;
  accountEmail: string;
  password: string;
}) {
  return db.softwareCredential.create({
    data: {
      name: data.name.trim(),
      category: data.category?.trim() || null,
      websiteUrl: data.websiteUrl || null,
      accountEmailCiphertext: encryptSoftwareSecret(data.accountEmail),
      passwordCiphertext: encryptSoftwareSecret(data.password),
    },
    select: { id: true, name: true },
  });
}

export async function updateSoftwareCredential(
  id: string,
  data: {
    name?: string;
    category?: string | null;
    websiteUrl?: string | null;
    accountEmail?: string;
    password?: string;
    archived?: boolean;
  },
) {
  const existing = await db.softwareCredential.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Software account not found.");

  return db.softwareCredential.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.category !== undefined ? { category: data.category?.trim() || null } : {}),
      ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl || null } : {}),
      ...(data.accountEmail !== undefined ? { accountEmailCiphertext: encryptSoftwareSecret(data.accountEmail) } : {}),
      ...(data.password !== undefined ? { passwordCiphertext: encryptSoftwareSecret(data.password) } : {}),
      ...(data.archived !== undefined ? { archivedAt: data.archived ? new Date() : null } : {}),
    },
    select: { id: true, name: true, archivedAt: true },
  });
}

export async function archiveSoftwareCredential(id: string) {
  return updateSoftwareCredential(id, { archived: true });
}

export async function revealSoftwarePassword(id: string) {
  const row = await db.softwareCredential.findUnique({
    where: { id },
    select: { id: true, name: true, archivedAt: true, passwordCiphertext: true },
  });
  if (!row || row.archivedAt) throw new HttpError(404, "Software account not found.");
  return { id: row.id, name: row.name, password: decryptSoftwareSecret(row.passwordCiphertext) };
}

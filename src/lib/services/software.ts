import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { decryptSoftwareSecret, encryptSoftwareSecret } from "@/lib/software-vault-crypto";
import { canViewSoftwareCredential, type SoftwareCredentialAudience } from "@/lib/software-vault-access";

const softwareCredentialSelect = {
  id: true,
  name: true,
  category: true,
  websiteUrl: true,
  accountEmailCiphertext: true,
  passwordCiphertext: true,
  visibleTo: true,
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
  visibleTo: SoftwareCredentialAudience[];
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
  visibleTo: SoftwareCredentialAudience[];
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
    visibleTo: row.visibleTo,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSoftwareCredentials({
  includeArchived = false,
  role,
  collaboratorCanView = false,
}: {
  includeArchived?: boolean;
  role: string;
  collaboratorCanView?: boolean;
}) {
  const rows = await db.softwareCredential.findMany({
    where: includeArchived ? undefined : { archivedAt: null },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    select: softwareCredentialSelect,
  });
  return rows
    .filter((row) => canViewSoftwareCredential(role, row.visibleTo, collaboratorCanView))
    .map((row) => toSummary(row));
}

export async function createSoftwareCredential(data: {
  name: string;
  category?: string | null;
  websiteUrl?: string | null;
  accountEmail: string;
  password: string;
  visibleTo: readonly SoftwareCredentialAudience[];
}) {
  const normalizedVisibleTo = [...new Set(data.visibleTo)] as SoftwareCredentialAudience[];
  if (normalizedVisibleTo.length === 0) throw new HttpError(400, "Choose at least one software audience.");

  return db.softwareCredential.create({
    data: {
      name: data.name.trim(),
      category: data.category?.trim() || null,
      websiteUrl: data.websiteUrl || null,
      accountEmailCiphertext: encryptSoftwareSecret(data.accountEmail),
      passwordCiphertext: encryptSoftwareSecret(data.password),
      visibleTo: normalizedVisibleTo,
    },
    select: { id: true, name: true, visibleTo: true },
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
    visibleTo?: readonly SoftwareCredentialAudience[];
    archived?: boolean;
  },
) {
  const existing = await db.softwareCredential.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Software account not found.");
  const normalizedVisibleTo = data.visibleTo === undefined
    ? undefined
    : [...new Set(data.visibleTo)] as SoftwareCredentialAudience[];
  if (normalizedVisibleTo?.length === 0) throw new HttpError(400, "Choose at least one software audience.");

  return db.softwareCredential.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.category !== undefined ? { category: data.category?.trim() || null } : {}),
      ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl || null } : {}),
      ...(data.accountEmail !== undefined ? { accountEmailCiphertext: encryptSoftwareSecret(data.accountEmail) } : {}),
      ...(data.password !== undefined ? { passwordCiphertext: encryptSoftwareSecret(data.password) } : {}),
      ...(normalizedVisibleTo !== undefined ? { visibleTo: normalizedVisibleTo } : {}),
      ...(data.archived !== undefined ? { archivedAt: data.archived ? new Date() : null } : {}),
    },
    select: { id: true, name: true, visibleTo: true, archivedAt: true },
  });
}

export async function archiveSoftwareCredential(id: string) {
  return updateSoftwareCredential(id, { archived: true });
}

export async function revealSoftwarePassword(
  id: string,
  viewer: { role: string; collaboratorCanView?: boolean },
) {
  const row = await db.softwareCredential.findUnique({
    where: { id },
    select: { id: true, name: true, archivedAt: true, passwordCiphertext: true, visibleTo: true },
  });
  if (!row || row.archivedAt || !canViewSoftwareCredential(viewer.role, row.visibleTo, viewer.collaboratorCanView)) {
    throw new HttpError(404, "Software account not found.");
  }
  return { id: row.id, name: row.name, password: decryptSoftwareSecret(row.passwordCiphertext) };
}

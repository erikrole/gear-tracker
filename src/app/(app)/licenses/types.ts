export type LicenseCodeStatus = "AVAILABLE" | "PARTIAL" | "CLAIMED" | "RETIRED";

export type ClaimHolder = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ActiveClaim = {
  id: string;
  userId: string | null;
  user: ClaimHolder | null;
  occupantLabel: string | null;
  claimedAt: string;
};

export type LicenseCode = {
  id: string;
  code: string;
  label: string | null;
  accountEmail: string | null;
  expiresAt: string | null;
  status: LicenseCodeStatus;
  claims: ActiveClaim[];
  createdAt: string;
};

export type MyLicense = {
  id: string;
  code: string;
  label: string | null;
  expiresAt: string | null;
  claimedAt: string;
  claimId: string;
};

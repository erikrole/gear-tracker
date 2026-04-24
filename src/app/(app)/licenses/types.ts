export type LicenseCodeStatus = "AVAILABLE" | "CLAIMED" | "RETIRED";

export type LicenseCodeHolder = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type LicenseCode = {
  id: string;
  code: string;
  label: string | null;
  status: LicenseCodeStatus;
  claimedById: string | null;
  claimedBy: LicenseCodeHolder | null;
  claimedAt: string | null;
  createdAt: string;
};

export type MyLicense = {
  id: string;
  code: string;
  label: string | null;
  claimedAt: string;
};

export type Role = "ADMIN" | "STAFF" | "STUDENT";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  primaryArea: string | null;
  locationId: string | null;
  location: string | null;
  avatarUrl: string | null;
};

export type SportAssignment = {
  id: string;
  sportCode: string;
  createdAt: string;
};

export type AreaAssignment = {
  id: string;
  area: string;
  isPrimary: boolean;
  createdAt: string;
};

export type UserDetail = UserRow & {
  sportAssignments: SportAssignment[];
  areaAssignments: AreaAssignment[];
};

export type Location = { id: string; name: string };

export type ListResponse = {
  data: UserRow[];
  total: number;
  limit: number;
  offset: number;
};

export type SortKey = "name" | "name_desc" | "role" | "role_desc" | "email" | "email_desc" | "";

export const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "badge-purple",
  STAFF: "badge-blue",
  STUDENT: "badge-gray",
};

export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Staff" },
  { value: "STUDENT", label: "Student" },
];

export const AREA_LABELS: Record<string, string> = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Communications",
};

export const AREA_OPTIONS = Object.entries(AREA_LABELS).map(([value, label]) => ({
  value,
  label,
}));

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
  active?: boolean;
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

export type StudentYear = "FRESHMAN" | "SOPHOMORE" | "JUNIOR" | "SENIOR" | "GRAD";

export type UserDetail = UserRow & {
  createdAt: string | null;
  sportAssignments: SportAssignment[];
  areaAssignments: AreaAssignment[];
  icsToken?: string | null;
  // Profile fields migrated from the team Sheet.
  title: string | null;
  athleticsEmail: string | null;
  startDate: string | null;
  directReportId: string | null;
  directReportName: string | null;
  directReport: { id: string; name: string } | null;
  gradYear: number | null;
  studentYearOverride: StudentYear | null;
  topSize: string | null;
  bottomSize: string | null;
  shoeSize: string | null;
};

export const STUDENT_YEAR_OPTIONS: { value: StudentYear; label: string }[] = [
  { value: "FRESHMAN", label: "Freshman" },
  { value: "SOPHOMORE", label: "Sophomore" },
  { value: "JUNIOR", label: "Junior" },
  { value: "SENIOR", label: "Senior" },
  { value: "GRAD", label: "Grad" },
];

/**
 * Derive a student's current academic year. Override wins; otherwise inferred from
 * grad year using a Sept→Aug academic calendar (Aug+ counts as the next class year).
 */
export function deriveStudentYear(
  gradYear: number | null,
  override: StudentYear | null,
  now: Date = new Date(),
): StudentYear | null {
  if (override) return override;
  if (gradYear == null) return null;
  const month = now.getMonth(); // 0–11
  const acadYearEnd = month >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  const yearsRemaining = gradYear - acadYearEnd;
  if (yearsRemaining <= -1) return "GRAD";
  if (yearsRemaining === 0) return "SENIOR";
  if (yearsRemaining === 1) return "JUNIOR";
  if (yearsRemaining === 2) return "SOPHOMORE";
  if (yearsRemaining >= 3) return "FRESHMAN";
  return null;
}

export type { Location } from "@/types/common";

export type ListResponse = {
  data: UserRow[];
  total: number;
  limit: number;
  offset: number;
};

export type SortKey = "name" | "name_desc" | "role" | "role_desc" | "email" | "email_desc" | "";

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

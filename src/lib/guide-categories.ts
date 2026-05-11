export const KNOWLEDGE_BASE_CATEGORY_SUGGESTIONS = [
  "Contacts",
  "Building Numbers",
  "Media Drive",
  "Server Paths",
  "SOPs",
  "How-To",
  "General Info",
  "Troubleshooting",
  "Accounts",
  "Event Ops",
] as const;

export const GUIDE_ROLE_OPTIONS = [
  { value: "STUDENT", label: "Students" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admins" },
] as const;

export const GUIDE_AREA_OPTIONS = [
  { value: "VIDEO", label: "Video" },
  { value: "PHOTO", label: "Photo" },
  { value: "GRAPHICS", label: "Graphics" },
  { value: "COMMS", label: "Comms" },
] as const;

export const GUIDE_AREA_LABELS = {
  VIDEO: "Video",
  PHOTO: "Photo",
  GRAPHICS: "Graphics",
  COMMS: "Comms",
} as const;

export const GUIDE_ROLE_LABELS = {
  STUDENT: "Students",
  STAFF: "Staff",
  ADMIN: "Admins",
} as const;

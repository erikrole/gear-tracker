import { z } from "zod";
import { SOFTWARE_CREDENTIAL_AUDIENCES } from "@/lib/software-vault-access";

const httpUrl = z
  .string()
  .max(500, "Website URL must be 500 characters or fewer")
  .url("Enter a valid website URL")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Website URL must use http or https");

const category = z.string().max(80, "Category must be 80 characters or fewer").nullable().optional();
const audience = z.enum(SOFTWARE_CREDENTIAL_AUDIENCES);
const visibleTo = z.array(audience).min(1, "Choose at least one audience").max(3, "Choose no more than three audiences");

export const DEFAULT_SOFTWARE_CREDENTIAL_AUDIENCES = ["STAFF", "STUDENT"] as const;

export const createSoftwareCredentialSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  category,
  websiteUrl: httpUrl.nullable().optional(),
  accountEmail: z.string().trim().email("Enter a valid account email").max(320, "Email is too long"),
  password: z.string().min(1, "Password is required").max(500, "Password must be 500 characters or fewer"),
  visibleTo: visibleTo.default([...DEFAULT_SOFTWARE_CREDENTIAL_AUDIENCES]),
});

export const updateSoftwareCredentialSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer").optional(),
  category,
  websiteUrl: httpUrl.nullable().optional(),
  accountEmail: z.string().trim().email("Enter a valid account email").max(320, "Email is too long").optional(),
  password: z.string().min(1, "Password cannot be empty").max(500, "Password must be 500 characters or fewer").optional(),
  visibleTo: visibleTo.optional(),
  archived: z.boolean().optional(),
});

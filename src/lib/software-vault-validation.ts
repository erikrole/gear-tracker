import { z } from "zod";

const httpUrl = z
  .string()
  .max(500, "Website URL must be 500 characters or fewer")
  .url("Enter a valid website URL")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Website URL must use http or https");

const category = z.string().max(80, "Category must be 80 characters or fewer").nullable().optional();

export const createSoftwareCredentialSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  category,
  websiteUrl: httpUrl.nullable().optional(),
  accountEmail: z.string().trim().email("Enter a valid account email").max(320, "Email is too long"),
  password: z.string().min(1, "Password is required").max(500, "Password must be 500 characters or fewer"),
});

export const updateSoftwareCredentialSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer").optional(),
  category,
  websiteUrl: httpUrl.nullable().optional(),
  accountEmail: z.string().trim().email("Enter a valid account email").max(320, "Email is too long").optional(),
  password: z.string().min(1, "Password cannot be empty").max(500, "Password must be 500 characters or fewer").optional(),
  archived: z.boolean().optional(),
});

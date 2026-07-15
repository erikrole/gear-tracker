import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { updateProfileSchema } from "@/lib/validation";

const userInfo = readFileSync("src/app/(app)/users/[id]/UserInfoTab.tsx", "utf8");
const settingsProfile = readFileSync("src/app/(app)/settings/profile/page.tsx", "utf8");
const staffRoute = readFileSync("src/app/api/users/[id]/route.ts", "utf8");
const selfRoute = readFileSync("src/app/api/profile/route.ts", "utf8");
const settingsRoute = readFileSync("src/app/api/me/profile/route.ts", "utf8");

describe("user profile phone fields", () => {
  it("accepts formatted personal and work phones but rejects non-phone text", () => {
    expect(updateProfileSchema.safeParse({
      personalPhone: "(608) 555-0111",
      workPhone: "608-555-0222 ext 4",
    }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ personalPhone: "call me" }).success).toBe(false);
  });

  it("shows both phone fields on canonical and Settings profile surfaces", () => {
    expect(userInfo).toContain('label="Personal Phone"');
    expect(userInfo).toContain('label="Work Phone"');
    expect(userInfo).toContain("patchUser({ personalPhone: v || null })");
    expect(userInfo).toContain("patchUser({ workPhone: v || null })");
    expect(settingsProfile).toContain("Personal phone");
    expect(settingsProfile).toContain("Work phone");
    expect(settingsProfile).toContain("personalPhone: form.personalPhone || null");
    expect(settingsProfile).toContain("workPhone: form.workPhone || null");
  });

  it("keeps personal phone compatible and work-phone applicability explicit in every update route", () => {
    expect(staffRoute).toContain("updateData.personalPhone = personalPhone");
    expect(staffRoute).toContain("updateData.phone = personalPhone");
    expect(staffRoute).toContain("updateData.workPhone = workPhone");
    expect(staffRoute).toContain("updateData.workPhoneNotApplicable = workPhone === null");
    for (const source of [selfRoute, settingsRoute]) {
      expect(source).toContain("data.personalPhone = personalPhone");
      expect(source).toContain("data.phone = personalPhone");
      expect(source).toContain("data.workPhone = workPhone");
      expect(source).toContain("data.workPhoneNotApplicable = workPhone === null");
    }
  });
});

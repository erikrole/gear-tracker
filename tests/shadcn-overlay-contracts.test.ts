import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walkFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkFiles(full, ext));
    } else if (full.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function src(relPath: string): string {
  return readFileSync(relPath, "utf-8");
}

describe("shadcn overlay contracts", () => {
  // --- Plan 028: SheetDescription coverage ---

  it("resources/page.tsx imports SheetDescription from @/components/ui/sheet", () => {
    const source = src("src/app/(app)/resources/page.tsx");
    expect(source).toMatch(/SheetDescription/);
    expect(source).toContain("@/components/ui/sheet");
  });

  it("resources/page.tsx contains both SheetContent and SheetDescription", () => {
    const source = src("src/app/(app)/resources/page.tsx");
    expect(source).toContain("SheetContent");
    expect(source).toContain("SheetDescription");
  });

  it("ShiftDetailPanel.tsx imports SheetDescription from @/components/ui/sheet", () => {
    const source = src("src/components/ShiftDetailPanel.tsx");
    expect(source).toMatch(/SheetDescription/);
    expect(source).toContain("@/components/ui/sheet");
  });

  it("ShiftDetailPanel.tsx contains both SheetContent and SheetDescription", () => {
    const source = src("src/components/ShiftDetailPanel.tsx");
    expect(source).toContain("SheetContent");
    expect(source).toContain("SheetDescription");
  });

  it("every app file with SheetContent also has SheetDescription", () => {
    const searchRoots = ["src/app", "src/components", "src/hooks"];
    const missing: string[] = [];

    for (const root of searchRoots) {
      let files: string[];
      try {
        files = [
          ...walkFiles(root, ".tsx"),
          ...walkFiles(root, ".ts"),
        ];
      } catch {
        continue;
      }

      for (const file of files) {
        if (file.startsWith("src/components/ui/")) continue;

        const source = readFileSync(file, "utf8");
        if (source.includes("SheetContent") && !source.includes("SheetDescription")) {
          missing.push(file);
        }
      }
    }

    expect(
      missing,
      `These files use SheetContent but are missing SheetDescription:\n${missing.join("\n")}`
    ).toHaveLength(0);
  });

  // --- Plan 029: destructive AlertDialog variant coverage ---

  describe("ConfirmDialog", () => {
    it("passes variant prop to AlertDialogAction for danger confirmations", () => {
      const source = src("src/components/ConfirmDialog.tsx");
      expect(source).toContain(
        `variant={state.variant === "danger" ? "destructive" : "default"}`,
      );
    });

    it("does not import buttonVariants", () => {
      const source = src("src/components/ConfirmDialog.tsx");
      expect(source).not.toContain("buttonVariants");
    });
  });

  describe("kits/[id]/page.tsx -- delete kit", () => {
    it("delete kit action uses variant=destructive", () => {
      const source = src("src/app/(app)/kits/[id]/page.tsx");
      const deleteKitBlock = source.slice(source.indexOf("Delete kit?"));
      expect(deleteKitBlock).toMatch(/AlertDialogAction[^>]*variant="destructive"/);
    });

    it("delete kit action does not use manual destructive classes", () => {
      const source = src("src/app/(app)/kits/[id]/page.tsx");
      expect(source).not.toContain(
        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      );
    });
  });

  describe("resources/edit -- delete resource", () => {
    it("delete resource action uses variant=destructive", () => {
      const source = src("src/app/(app)/resources/[slug]/edit/_components/EditGuideClient.tsx");
      expect(source).toMatch(/AlertDialogAction[^>]*variant="destructive"/);
    });
  });

  describe("licenses/ReleaseDialog -- return license", () => {
    it("return license action uses variant=destructive", () => {
      const source = src("src/app/(app)/licenses/ReleaseDialog.tsx");
      expect(source).toMatch(/AlertDialogAction[^>]*variant="destructive"/);
    });
  });

  describe("licenses/AdminClaimSheet -- release, release-all, retire, delete", () => {
    it("release all slots action uses variant=destructive", () => {
      const source = src("src/app/(app)/licenses/AdminClaimSheet.tsx");
      const releaseAllBlock = source.slice(source.indexOf("Release all slots?"));
      expect(releaseAllBlock).toMatch(/AlertDialogAction[^>]*variant="destructive"/);
    });

    it("retire action uses variant=destructive", () => {
      const source = src("src/app/(app)/licenses/AdminClaimSheet.tsx");
      const retireBlock = source.slice(source.indexOf("Retire this license?"));
      expect(retireBlock).toMatch(/AlertDialogAction[^>]*variant="destructive"/);
    });

    it("delete action uses variant=destructive", () => {
      const source = src("src/app/(app)/licenses/AdminClaimSheet.tsx");
      const deleteBlock = source.slice(source.indexOf("Delete this license?"));
      expect(deleteBlock).toMatch(/AlertDialogAction[^>]*variant="destructive"/);
    });

    it("delete action does not use manual destructive classes", () => {
      const source = src("src/app/(app)/licenses/AdminClaimSheet.tsx");
      expect(source).not.toContain(
        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      );
    });
  });
});

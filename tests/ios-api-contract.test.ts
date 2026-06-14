import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

/**
 * iOS ↔ API response-contract pins.
 *
 * Swift JSONDecoder fails the ENTIRE response when one required key is
 * missing or null, so server-side shape changes that are invisible to the
 * web TypeScript client (types erased at runtime) brick iOS screens.
 * This suite pins both sides of every contract that has actually broken:
 * change either side and the matching assertion here fails, pointing at
 * the sibling that must move in the same commit.
 *
 * History: FormUser.email (bb45e74a), the 6 drift fixes in 66ff9e8f, and
 * the kiosk/URL fixes in 51f97d31. See tasks/lessons.md sessions
 * 2026-05-28 and 2026-06-09.
 */
describe("iOS API contracts — form options", () => {
  it("FormUser only requires fields the server selects", () => {
    const route = source("src/app/api/form-options/route.ts");
    const models = source("ios/Wisconsin/Models/FormModels.swift");

    // Server users select must keep at least id + name…
    expect(route).toMatch(/db\.user\.findMany\(\{[\s\S]*?select: \{ id: true, name: true/);
    // …and the Swift model must not REQUIRE anything beyond them.
    // (Optional fields are fine — missing keys decode to nil.)
    const structBody = models.slice(
      models.indexOf("struct FormUser"),
      models.indexOf("struct FormBulkSku"),
    );
    const requiredFields = [...structBody.matchAll(/let (\w+): (\S+)/g)]
      .filter((match) => !(match[2] ?? "").endsWith("?"))
      .map((match) => match[1]);
    expect(requiredFields.sort()).toEqual(["id", "name"]);
  });

  it("FormOptions keeps bulk SKU picker data without requiring it from legacy responses", () => {
    const route = source("src/app/api/form-options/route.ts");
    const models = source("ios/Wisconsin/Models/FormModels.swift");

    expect(route).toMatch(/db\.bulkSku\.findMany\(\{[\s\S]*?select: \{[\s\S]*?availableQuantity/);
    expect(models).toContain("struct FormBulkSku");
    expect(models).toContain("let bulkSkus: [FormBulkSku]");
    expect(models).toContain("bulkSkus = try container.decodeIfPresent([FormBulkSku].self, forKey: .bulkSkus) ?? []");
  });
});

describe("iOS API contracts — reservation create payload", () => {
  it("iOS sends typed bulk items to the existing reservation schema", () => {
    const validation = source("src/lib/validation.ts");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");

    expect(validation).toContain("bulkSkuId: z.string().cuid()");
    expect(validation).toContain("quantity: z.number().int().positive()");
    expect(apiClient).toContain("struct BulkReservationRequest: Encodable, Equatable");
    expect(apiClient).toContain("bulkItems: [BulkReservationRequest] = []");
    expect(apiClient).toContain("let bulkItems: [BulkReservationRequest]");
    expect(apiClient).toContain("bulkItems: bulkItems");
    expect(apiClient).not.toContain("let bulkItems: [String]");
    expect(apiClient).not.toContain("bulkItems: [],");
  });
});

describe("iOS API contracts — asset lookup item families", () => {
  it("iOS decodes /api/assets bulkItems and treats them as scan/search results", () => {
    const route = source("src/app/api/assets/route.ts");
    const models = source("ios/Wisconsin/Models/AssetModels.swift");
    const searchService = source("ios/Wisconsin/Core/SearchService.swift");
    const scanView = source("ios/Wisconsin/Views/ScanView.swift");
    const scanner = source("ios/Wisconsin/Views/Search/QRScannerSheet.swift");

    expect(route).toContain("bulkItems,");
    expect(route).toContain("matchedUnitNumber");
    expect(models).toContain("struct AssetFamilySearchResult");
    expect(models).toContain("let bulkItems: [AssetFamilySearchResult]");
    expect(models).toContain("decodeIfPresent([AssetFamilySearchResult].self, forKey: .bulkItems) ?? []");
    expect(searchService).toContain("var itemFamilies: [AssetFamilySearchResult] = []");
    expect(searchService).toContain("itemsResp.bulkItems");
    expect(searchService).toContain("itemFamilies.isEmpty");
    expect(scanView).toContain("ItemFamilyResultRow(family: family)");
    expect(scanner).toContain("case itemFamily(AssetFamilySearchResult)");
    expect(scanner).toContain("onMatch(.itemFamily(family))");
  });
});

describe("iOS API contracts — availability check", () => {
  it("iOS decodes the route's top-level result (no data envelope)", () => {
    const route = source("src/app/api/availability/check/route.ts");
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");

    // Route returns the availability result spread at the top level.
    expect(route).toContain("return ok({ ...result, bulkAvailability });");
    // iOS must decode conflicts at the top level, not under `data`.
    expect(apiClient).toContain("struct CheckResponse: Decodable { let conflicts: [AssetConflict]? }");
    expect(apiClient).toContain("for conflict in resp.conflicts ?? []");
  });
});

describe("iOS API contracts — nullable columns stay optional in Swift", () => {
  it("AssetAccessory.serialNumber is optional (Asset.serialNumber is nullable)", () => {
    const schema = source("prisma/schema.prisma");
    const models = source("ios/Wisconsin/Models/AssetModels.swift");

    expect(schema).toMatch(/serialNumber\s+String\?\s+@unique @map\("serial_number"\)/);
    expect(models).toMatch(/struct AssetAccessory[\s\S]*?let serialNumber: String\?/);
  });

  it("AvailabilityBlock.dayOfWeek is optional (AD_HOC blocks have no weekday)", () => {
    const schema = source("prisma/schema.prisma");
    const models = source("ios/Wisconsin/Models/ScheduleModels.swift");

    expect(schema).toMatch(/dayOfWeek\s+Int\?\s+@map\("day_of_week"\)/);
    expect(models).toMatch(/struct AvailabilityBlock[\s\S]*?let dayOfWeek: Int\?/);
  });
});

describe("iOS API contracts — notification preferences", () => {
  it("iOS sends the pausedUntil key explicitly (PUT schema requires it)", () => {
    const route = source("src/app/api/me/notification-preferences/route.ts");
    const models = source("ios/Wisconsin/Models/Models.swift");

    // Zod `.nullable()` without `.optional()` = the key must be present.
    expect(route).toContain("pausedUntil: z.string().datetime({ offset: true }).nullable()");
    // Swift's synthesized encoder omits nil optionals; the custom encoder
    // must write an explicit null.
    expect(models).toMatch(/func encode\(to encoder: Encoder\) throws[\s\S]*?try container\.encode\(pausedUntil, forKey: \.pausedUntil\)/);
  });

  it("iOS round-trips badges/categories so a save doesn't reset web prefs", () => {
    const models = source("ios/Wisconsin/Models/Models.swift");

    expect(models).toMatch(/struct NotificationPreferences[\s\S]*?var badges: Bool\?/);
    expect(models).toMatch(/struct NotificationPreferences[\s\S]*?var categories: Categories\?/);
    expect(models).toContain("try container.encodeIfPresent(badges, forKey: .badges)");
    expect(models).toContain("try container.encodeIfPresent(categories, forKey: .categories)");
  });
});

describe("iOS API contracts — mutation responses match list shapes", () => {
  it("POST /api/shift-groups returns the event relation EventShiftGroup requires", () => {
    const route = source("src/app/api/shift-groups/route.ts");
    const models = source("ios/Wisconsin/Models/ScheduleModels.swift");

    // Swift model requires a non-optional event…
    expect(models).toMatch(/struct EventShiftGroup[\s\S]*?let event: ShiftGroupEvent\b/);
    // …so the POST include must load it (same shape as GET).
    const postSection = route.slice(route.indexOf("export const POST"));
    expect(postSection).toMatch(/shiftGroup\.create\(\{[\s\S]*?include: \{\s*event: \{/);
  });

  it("cancelTrade returns the same relations as post/claim (ShiftTrade requires them)", () => {
    const service = source("src/lib/services/shift-trades.ts");
    const models = source("ios/Wisconsin/Models/ShiftTradeModels.swift");

    expect(models).toMatch(/struct ShiftTrade[\s\S]*?let postedBy: ShiftTradeUser\b/);
    expect(models).toMatch(/struct ShiftTrade[\s\S]*?let shiftAssignment: ShiftTradeAssignment\b/);

    const cancelSection = service.slice(
      service.indexOf("export async function cancelTrade"),
      service.indexOf("export async function listTrades"),
    );
    expect(cancelSection).toMatch(/shiftTrade\.update\(\{[\s\S]*?include: \{[\s\S]*?shiftAssignment: \{[\s\S]*?postedBy: \{/);
  });
});

describe("iOS API contracts — asset metadata leniency", () => {
  it("parseNotes only treats plain JSON objects as metadata", () => {
    const route = source("src/app/api/assets/[id]/route.ts");

    // JSON.parse accepts scalars ("1234") — without this guard a numeric
    // note is hidden on web and `metadata` becomes a non-object that breaks
    // the iOS asset-detail decode.
    expect(route).toMatch(/typeof parsed === "object" && !Array\.isArray\(parsed\)/);
  });

  it("AssetMetadata degrades to nil on malformed legacy JSON", () => {
    const models = source("ios/Wisconsin/Models/AssetModels.swift");

    const structBody = models.slice(
      models.indexOf("struct AssetMetadata"),
      models.indexOf("struct AssetDetail"),
    );
    expect(structBody).toContain("let container = try? decoder.container(keyedBy: CodingKeys.self)");
    expect(structBody).toContain("(try? container?.decodeIfPresent(String.self, forKey: .uwAssetTag)) ?? nil");
  });
});

describe("iOS API contracts — kiosk session", () => {
  it("kioskMe decodes the route's top-level shape (no data envelope)", () => {
    const route = source("src/app/api/kiosk/me/route.ts");
    const client = source("ios/Wisconsin/Kiosk/KioskAPIClient.swift");

    expect(route).toMatch(/return ok\(\{\s*kioskId: kiosk\.kioskId/);
    const kioskMe = client.slice(
      client.indexOf("struct KioskMeResponse"),
      client.indexOf("func kioskActivate"),
    );
    // Top-level fields, no data envelope. `name` stays Optional so the app
    // tolerates older servers that don't return the device name yet.
    expect(kioskMe).toContain("let kioskId: String");
    expect(kioskMe).toContain("let locationId: String");
    expect(kioskMe).toContain("let locationName: String");
    expect(kioskMe).toContain("let name: String?");
    expect(kioskMe).not.toContain("DataWrapper");
  });

  it("activation persists a raw kiosk token even during API rollout skew", () => {
    const route = source("src/app/api/kiosk/activate/route.ts");
    const client = source("ios/Wisconsin/Kiosk/KioskAPIClient.swift");
    const store = source("ios/Wisconsin/Kiosk/KioskStore.swift");

    expect(route).toContain("sessionToken,");
    expect(client).toContain("let result: (KioskActivationResponse, HTTPURLResponse) = try await performWithResponse(req)");
    expect(client).toContain("kioskSessionToken(from: http)");
    expect(client).toContain("cookieValue(named: \"kiosk_session\"");
    expect(store).toContain("KioskSessionVault.save(sessionToken)");
  });

  it("validateSession only clears the activation on a definitive 401", () => {
    const store = source("ios/Wisconsin/Kiosk/KioskStore.swift");

    const validate = store.slice(
      store.indexOf("private func validateSession()"),
      store.indexOf("func activate("),
    );
    expect(validate).toContain("catch APIError.unauthorized");
    // The unauthorized branch clears; the generic branch must NOT.
    const genericCatch = validate.slice(validate.lastIndexOf("} catch {"));
    expect(genericCatch).not.toContain("clearStoredInfo()");
    expect(genericCatch).toContain("startHeartbeat()");
  });
});

describe("iOS API contracts — URL construction", () => {
  it("no query string is embedded in a request(path:) literal", () => {
    // appendingPathComponent percent-encodes `?`, so `?force=true` inside a
    // path literal becomes part of the last route param and the server 404s.
    for (const file of [
      "ios/Wisconsin/Core/APIClient.swift",
      "ios/Wisconsin/Kiosk/KioskAPIClient.swift",
    ]) {
      const text = source(file);
      const embedded = text.match(/request\(\s*path: "[^"]*\?[^"]*"/g) ?? [];
      expect(embedded, `${file} embeds a query string in request(path:): ${embedded.join(", ")}`).toEqual([]);
    }
  });

  it("deleteShift passes force=true as a query item", () => {
    const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
    expect(apiClient).toMatch(/func deleteShift[\s\S]*?queryItems: \[\.init\(name: "force", value: "true"\)\]/);
  });
});

describe("iOS project configuration", () => {
  it("XcodeGen and the checked-in Xcode project use the same bundle identifier", () => {
    const projectYml = source("ios/project.yml");
    const pbxproj = source("ios/Wisconsin.xcodeproj/project.pbxproj");

    expect(projectYml).toContain("bundleId: com.erikrole.Wisconsin");
    expect(pbxproj).toMatch(/PRODUCT_BUNDLE_IDENTIFIER = com\.erikrole\.Wisconsin;/);
    expect(projectYml).not.toContain("bundleId: com.erikrole.creative");
  });
});

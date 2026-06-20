import { describe, expect, it } from "vitest";
import { auditVenueMappings, type VenueAuditLocation, type VenueAuditMapping } from "@/lib/venue-mapping-audit";

const campRandall: VenueAuditLocation = {
  id: "loc-camp",
  name: "Camp Randall Stadium",
  active: true,
  isHomeVenue: true,
};

const fieldHouse: VenueAuditLocation = {
  id: "loc-fieldhouse",
  name: "UW Field House",
  active: true,
  isHomeVenue: true,
};

function mapping(overrides: Partial<VenueAuditMapping>): VenueAuditMapping {
  return {
    id: "map-1",
    pattern: "Camp Randall",
    locationId: "loc-camp",
    location: campRandall,
    ...overrides,
  };
}

describe("auditVenueMappings", () => {
  it("reports active home venues that have no active venue mapping", () => {
    const audit = auditVenueMappings(
      [campRandall, fieldHouse],
      [mapping({ locationId: "loc-camp", location: campRandall })],
    );

    expect(audit.homeVenuesWithoutMappings).toEqual([fieldHouse]);
  });

  it("reports mappings pointing at missing or inactive locations", () => {
    const inactiveLocation = {
      id: "loc-old",
      name: "Old Arena",
      active: false,
      isHomeVenue: true,
    };
    const missing = mapping({ id: "map-missing", locationId: "loc-missing", location: null });
    const inactive = mapping({ id: "map-inactive", pattern: "Old Arena", locationId: "loc-old", location: inactiveLocation });

    const audit = auditVenueMappings([inactiveLocation], [missing, inactive]);

    expect(audit.mappingsToMissingLocations).toEqual([missing]);
    expect(audit.mappingsToInactiveLocations).toEqual([inactive]);
  });

  it("reports home-looking mappings that point to a non-home active location", () => {
    const nonHomeCamp = {
      id: "loc-support",
      name: "Camp Randall Stadium",
      active: true,
      isHomeVenue: false,
    };
    const badMapping = mapping({ locationId: "loc-support", location: nonHomeCamp });

    const audit = auditVenueMappings([nonHomeCamp], [badMapping]);

    expect(audit.homeMappingsToNonHomeLocations).toEqual([badMapping]);
  });
});

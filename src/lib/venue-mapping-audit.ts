export type VenueAuditLocation = {
  id: string;
  name: string;
  active: boolean;
  isHomeVenue: boolean;
};

export type VenueAuditMapping = {
  id: string;
  pattern: string;
  locationId: string;
  location: VenueAuditLocation | null;
};

export type VenueMappingAudit = {
  homeVenuesWithoutMappings: VenueAuditLocation[];
  mappingsToMissingLocations: VenueAuditMapping[];
  mappingsToInactiveLocations: VenueAuditMapping[];
  homeMappingsToNonHomeLocations: VenueAuditMapping[];
};

function patternMatchesLocation(pattern: string, locationName: string) {
  try {
    return new RegExp(pattern, "i").test(locationName);
  } catch {
    return locationName.toLowerCase().includes(pattern.toLowerCase());
  }
}

function looksLikeHomeVenueMapping(mapping: VenueAuditMapping) {
  return mapping.location ? patternMatchesLocation(mapping.pattern, mapping.location.name) : false;
}

export function auditVenueMappings(
  locations: VenueAuditLocation[],
  mappings: VenueAuditMapping[],
): VenueMappingAudit {
  const activeMappingsByLocation = new Map<string, VenueAuditMapping[]>();
  for (const mapping of mappings) {
    if (mapping.location?.active) {
      const existing = activeMappingsByLocation.get(mapping.locationId) ?? [];
      existing.push(mapping);
      activeMappingsByLocation.set(mapping.locationId, existing);
    }
  }

  return {
    homeVenuesWithoutMappings: locations
      .filter((location) => location.active && location.isHomeVenue)
      .filter((location) => !activeMappingsByLocation.has(location.id)),
    mappingsToMissingLocations: mappings.filter((mapping) => mapping.location === null),
    mappingsToInactiveLocations: mappings.filter((mapping) => mapping.location?.active === false),
    homeMappingsToNonHomeLocations: mappings.filter((mapping) =>
      Boolean(mapping.location && mapping.location.active && !mapping.location.isHomeVenue && looksLikeHomeVenueMapping(mapping))
    ),
  };
}

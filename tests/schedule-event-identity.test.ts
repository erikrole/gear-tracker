import { describe, expect, it } from "vitest";
import {
  buildVenueSearchText,
  cleanSourceSummary,
  normalizeOpponentName,
  normalizeVenueText,
} from "@/lib/schedule-event-identity";

describe("schedule event identity normalization", () => {
  it("cleans source summaries without removing real event qualifiers", () => {
    expect(cleanSourceSummary("[A] Wisconsin Athletics Volleyball vs Kentucky (Neutral)")).toBe("Volleyball vs Kentucky");
  });

  it("normalizes rankings and school-name boilerplate from opponents", () => {
    expect(normalizeOpponentName("No. 9 University of Illinois")).toBe("Illinois");
    expect(normalizeOpponentName("#12 Louisville University - Invitational")).toBe("Louisville - Invitational");
  });

  it("keeps abbreviated team names in all caps", () => {
    expect(normalizeOpponentName("Tcu - Big 12")).toBe("TCU - Big 12");
    expect(normalizeOpponentName("Usc / Ucla")).toBe("USC / UCLA");
  });

  it("normalizes venue spelling for matching while preserving city context", () => {
    expect(normalizeVenueText("Green Bay, Wis.,  Lambeau Field")).toBe("Green Bay, WI, Lambeau Field");
    expect(buildVenueSearchText("Madison, Wis., Mcclimon Track / Soccer Complex")).toBe(
      "madison, wi, mcclimon track/soccer complex",
    );
  });
});

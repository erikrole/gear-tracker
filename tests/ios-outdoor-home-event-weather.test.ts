import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

function sliceBetween(sourceText: string, start: string, end: string) {
  const startIndex = sourceText.indexOf(start);
  const endIndex = sourceText.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sourceText.slice(startIndex, endIndex);
}

describe("iOS outdoor home-event weather", () => {
  it("excludes only covered home venues from WeatherKit", () => {
    const service = source("ios/Wisconsin/Core/EventWeatherService.swift");

    expect(service).toContain("guard isHome == true else { return false }");
    expect(service).toContain('"kohl center"');
    expect(service).toContain('"field house"');
    expect(service).toContain('"labahn"');
    expect(service).toContain("return !coveredVenueTerms.contains");
    expect(service).toContain('"FB"');
    expect(service).toContain('"MSOC", "WSOC"');
    expect(service).toContain("guard event.isOutdoorHomeEvent else { return nil }");
    expect(service).not.toContain("guard event.isHome == true else { return nil }");
  });

  it("restores one quiet Schedule-row signal and keeps VoiceOver complete", () => {
    const schedule = source("ios/Wisconsin/Views/ScheduleView.swift");
    const eventRow = sliceBetween(schedule, "struct EventRow: View", "private func calendarSame");

    expect(eventRow).toContain("@State private var weatherData: EventWeatherData?");
    expect(eventRow).toContain(".task(id: event.id)");
    expect(eventRow).toContain("EventWeatherService.shared.weather(for: event)");
    expect(eventRow).toContain("WeatherBadge(data: weatherData)");
    expect(eventRow).toContain('parts.append("Weather \\(weatherData.temperature)")');
    expect(eventRow).not.toContain("Apple Weather");
    expect(schedule).toContain("private struct WeatherBadge: View");
    expect(schedule).toContain(".accessibilityHidden(true)");
  });

  it("retains Apple Weather attribution on Event detail", () => {
    const detail = source("ios/Wisconsin/Views/EventDetailSheet.swift");

    expect(detail).toContain("EventWeatherService.shared.weather(for: event)");
    expect(detail).toContain("https://weatherkit.apple.com/legal-attribution.html");
  });
});

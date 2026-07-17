import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SaveableField } from "@/components/SaveableField";

type RenderableSaveableFieldProps = Omit<React.ComponentProps<typeof SaveableField>, "children"> & {
  children?: React.ReactNode;
};
const RenderableSaveableField = SaveableField as React.ComponentType<RenderableSaveableFieldProps>;

describe("SaveableField accessibility", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  function renderActions(label: React.ReactNode, ariaLabel?: string) {
    return renderToStaticMarkup(React.createElement(
      RenderableSaveableField,
      {
        label,
        ariaLabel,
        isDirty: true,
        onCommit: () => undefined,
        onCancel: () => undefined,
      },
      React.createElement("input"),
    ));
  }

  it("names dirty-row save and cancel actions with a string field label", () => {
    const markup = renderActions("Booking title");

    expect(markup).toContain('aria-label="Save Booking title"');
    expect(markup).toContain('aria-label="Cancel Booking title"');
    expect(markup).not.toContain('aria-label="Save"');
    expect(markup).not.toContain('aria-label="Cancel"');
  });

  it("uses the explicit accessible label when the visual label is not a string", () => {
    const markup = renderActions(React.createElement("span", null, "Title"), "Reservation title");

    expect(markup).toContain('aria-label="Save Reservation title"');
    expect(markup).toContain('aria-label="Cancel Reservation title"');
  });
});

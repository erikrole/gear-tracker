/**
 * Equipment guidance rules for the checkout picker.
 *
 * Each rule defines a condition (based on selected equipment and active section)
 * and a message to display when the condition is met. Rules are evaluated in order
 * and all matching rules are shown.
 */

import type { EquipmentSectionKey } from "./equipment-sections";

export type GuidanceContext = {
  /** Equipment section keys that have at least one selected item */
  selectedSectionKeys: EquipmentSectionKey[];
  /** The currently active/visible section in the picker */
  activeSection: EquipmentSectionKey;
};

export type GuidanceRule = {
  id: string;
  /** Which section this hint should appear in (or null for any section) */
  section: EquipmentSectionKey | null;
  /** Human-readable guidance message */
  message: string;
  /** Severity for styling: "info" (default) or "warning" */
  level: "info" | "warning";
  /** Return true if this rule should be shown */
  condition: (ctx: GuidanceContext) => boolean;
};

/**
 * Built-in guidance rules.
 * Add new rules here — the picker renders all that match.
 */
export const EQUIPMENT_GUIDANCE_RULES: GuidanceRule[] = [
  {
    id: "body-needs-batteries",
    section: "batteries",
    message: "You selected a camera body \u2014 don\u2019t forget batteries and chargers.",
    level: "warning",
    condition: (ctx) => ctx.selectedSectionKeys.includes("cameras"),
  },
  {
    id: "lens-needs-body",
    section: "lenses",
    message: "You\u2019ve added lenses but no camera body. Add a body in the Cameras tab.",
    level: "warning",
    condition: (ctx) =>
      ctx.selectedSectionKeys.includes("lenses") &&
      !ctx.selectedSectionKeys.includes("cameras"),
  },
  {
    id: "audio-with-video",
    section: "audio",
    message: "Don\u2019t forget audio gear \u2014 recorder, microphone, or wireless kit.",
    level: "info",
    condition: (ctx) => ctx.selectedSectionKeys.includes("cameras"),
  },
];

/**
 * Evaluate all guidance rules and return the ones that match.
 */
export function getActiveGuidance(ctx: GuidanceContext): GuidanceRule[] {
  return EQUIPMENT_GUIDANCE_RULES.filter(
    (rule) =>
      (rule.section === null || rule.section === ctx.activeSection) &&
      rule.condition(ctx)
  );
}

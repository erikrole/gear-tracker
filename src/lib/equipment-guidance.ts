/**
 * Equipment guidance rules for the checkout picker.
 *
 * Each rule defines a condition (based on selected equipment and active section)
 * and a message to display when the condition is met. Rules are evaluated in order
 * and all matching rules are shown.
 *
 * Future compatibility suggestions (e.g. FX6 → Gold Mount batteries) can be
 * added as new rules without changing the rendering logic.
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
    message: "You selected a camera body — don\u2019t forget batteries and chargers.",
    level: "warning",
    condition: (ctx) => ctx.selectedSectionKeys.includes("camera_body"),
  },
  {
    id: "lens-needs-body",
    section: "lenses",
    message: "You\u2019ve added lenses but no camera body. Add a body in the Bodies section.",
    level: "warning",
    condition: (ctx) =>
      ctx.selectedSectionKeys.includes("lenses") &&
      !ctx.selectedSectionKeys.includes("camera_body"),
  },
  {
    id: "audio-with-video",
    section: "other",
    message: "Don\u2019t forget audio gear \u2014 recorder, microphone, or wireless kit.",
    level: "info",
    condition: (ctx) => ctx.selectedSectionKeys.includes("camera_body"),
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

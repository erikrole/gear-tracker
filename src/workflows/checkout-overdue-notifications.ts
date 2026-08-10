import { sleep } from "workflow";
import {
  getCheckoutEscalationStageTiming,
  processCheckoutEscalationStage,
} from "@/lib/services/notifications";
import {
  CHECKOUT_ESCALATION_STAGE_TYPES,
  type CheckoutEscalationStageType,
} from "@/lib/checkout-escalation-policy";

export async function checkoutOverdueNotificationsWorkflow(
  bookingId: string,
  expectedEndsAtIso: string,
) {
  "use workflow";

  const results = [];
  for (const stageType of CHECKOUT_ESCALATION_STAGE_TYPES) {
    const result = await runCheckoutEscalationStage(
      bookingId,
      expectedEndsAtIso,
      stageType,
    );
    results.push(result);
    if (result.status === "superseded" || result.status === "closed") break;
  }
  return results;
}

async function runCheckoutEscalationStage(
  bookingId: string,
  expectedEndsAtIso: string,
  stageType: CheckoutEscalationStageType,
) {
  "use workflow";

  for (;;) {
    const timing = await getCheckoutEscalationStageTimingStep(
      bookingId,
      expectedEndsAtIso,
      stageType,
    );
    if (timing.status !== "scheduled") return timing;

    const triggerAt = new Date(timing.triggerAt);
    if (triggerAt.getTime() > Date.now()) await sleep(triggerAt);

    const result = await processCheckoutEscalationStageStep(
      bookingId,
      expectedEndsAtIso,
      stageType,
    );
    if (result.status !== "not_eligible") return result;
  }
}

async function getCheckoutEscalationStageTimingStep(
  bookingId: string,
  expectedEndsAtIso: string,
  stageType: CheckoutEscalationStageType,
) {
  "use step";
  return getCheckoutEscalationStageTiming({
    bookingId,
    expectedEndsAt: new Date(expectedEndsAtIso),
    stageType,
  });
}

async function processCheckoutEscalationStageStep(
  bookingId: string,
  expectedEndsAtIso: string,
  stageType: CheckoutEscalationStageType,
) {
  "use step";
  return processCheckoutEscalationStage({
    bookingId,
    expectedEndsAt: new Date(expectedEndsAtIso),
    stageType,
  });
}

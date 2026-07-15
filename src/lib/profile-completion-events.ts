export const OPEN_PROFILE_COMPLETION_EVENT = "gear-tracker:open-profile-completion";

export function openProfileCompletion() {
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_COMPLETION_EVENT));
}

export const AUTH_EMAIL_DOMAIN_NOTE =
  "Login using your @wisc.edu email address.";

export function shouldSuggestWiscEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@athletics.wisc.edu");
}

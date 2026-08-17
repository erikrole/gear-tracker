import { redirect } from "next/navigation";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Compatibility alias for old invitation links. New onboarding starts from
 * the normal email-first login surface so the web and native app follow one
 * path. Preserve an old email query only as a convenience prefill.
 */
export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = searchParams ? await searchParams : {};
  const rawEmail = params.email;
  const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const target = email?.trim()
    ? `/login?email=${encodeURIComponent(email.trim())}`
    : "/login";

  redirect(target);
}

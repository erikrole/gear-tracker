"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useFetch } from "@/hooks/use-fetch";

type MeData = { user: { id: string } };

/**
 * /profile redirects to /users/{currentUserId}.
 * Profile is now the user detail page for the current user.
 */
export default function ProfileRedirect() {
  const router = useRouter();

  const { data, error } = useFetch<MeData>({
    url: "/api/me",
    transform: (json) => json as unknown as MeData,
    refetchOnFocus: false,
  });

  useEffect(() => {
    if (data?.user?.id) {
      router.replace(`/users/${data.user.id}`);
    } else if (error) {
      router.replace("/login");
    }
  }, [data, error, router]);

  return (
    <div className="flex items-center justify-center py-10">
      <Spinner className="size-8" />
    </div>
  );
}

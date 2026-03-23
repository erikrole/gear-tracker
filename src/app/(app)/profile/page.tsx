"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/**
 * /profile redirects to /users/{currentUserId}.
 * Profile is now the user detail page for the current user.
 */
export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((json) => {
        if (json?.user?.id) {
          router.replace(`/users/${json.user.id}`);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="flex items-center justify-center py-10">
      <Spinner className="size-8" />
    </div>
  );
}

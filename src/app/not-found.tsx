import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div style={{ padding: 40, textAlign: "center", maxWidth: 480, margin: "80px auto" }}>
      <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: 8 }}>Page not found</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: "var(--text-sm)" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}

import { CameraIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function PhotoMechanicPage() {
  return (
    <div>
      <PageHeader title="Photo Mechanic" />
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="rounded-full bg-muted/60 p-5">
          <CameraIcon className="size-10 text-muted-foreground/40" />
        </div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
          Coming soon
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Photo Mechanic integration is under development. Check back later.
        </p>
      </div>
    </div>
  );
}

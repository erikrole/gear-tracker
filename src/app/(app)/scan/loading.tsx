import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Skeleton className="size-48 rounded-2xl" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";

export default function LoginLoading() {
  return (
    <main className="login-bg min-h-screen flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <Image src="/Badgers.png" alt="Wisconsin" width={48} height={48} className="size-12 object-contain" priority />
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    </main>
  );
}

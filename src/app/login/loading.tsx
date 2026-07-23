import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";

export default function LoginLoading() {
  return (
    <main className="login-bg min-h-screen flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <Image src="/Badgers.png" alt="Wisconsin" width={56} height={56} className="size-14 object-contain" priority />
        <Spinner className="size-6 text-white/60" />
      </div>
    </main>
  );
}

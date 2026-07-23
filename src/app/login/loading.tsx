import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";

export default function LoginLoading() {
  return (
    <main className="login-bg min-h-screen flex items-center justify-center p-4">
      <div className="flex flex-col items-center">
        <Image src="/Badgers.png" alt="Wisconsin" width={64} height={64} className="size-16 object-contain drop-shadow-lg mb-4" priority />
        <h1 className="login-lockup-title text-[1.875rem] leading-tight">Wisconsin Creative</h1>
        <Spinner className="size-6 text-white/60 mt-6" />
      </div>
    </main>
  );
}

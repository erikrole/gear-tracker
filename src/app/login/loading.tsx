import { Spinner } from "@/components/ui/spinner";

export default function LoginLoading() {
  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <img src="/Badgers.png" alt="Wisconsin" className="size-12 object-contain" />
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    </div>
  );
}

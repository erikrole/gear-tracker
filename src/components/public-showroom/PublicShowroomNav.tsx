"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { publicShowroomNav } from "@/lib/public-showroom";

export function PublicShowroomNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/88 text-white shadow-[0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/about" aria-label="Wisconsin Creative public pages" className="flex min-h-10 items-center gap-3 rounded-md pr-2 text-sm font-semibold outline-none transition-[opacity] hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-white/30 motion-reduce:transition-none">
          <Image src="/Badgers.png" alt="" width={34} height={34} className="size-8 object-contain" priority />
          <span className="hidden sm:inline">Wisconsin Creative</span>
        </Link>

        <nav aria-label="Public pages" className="hidden items-center gap-1 md:flex">
          {publicShowroomNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "min-h-10 rounded-full px-3 py-2 text-sm font-medium text-white/64 outline-none transition-[background-color,color,box-shadow] motion-reduce:transition-none",
                  "hover:bg-white/10 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/30",
                  active && "bg-white text-black hover:bg-white hover:text-black"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Button asChild variant="secondary" size="sm" className="h-10 rounded-full bg-white text-black hover:bg-white/90">
          <Link href="/login">
            Sign in
            <LogInIcon className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="border-t border-white/10 px-4 py-2 md:hidden">
        <nav aria-label="Public page sections" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
          {publicShowroomNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-3 py-2 text-sm font-medium text-white/64 outline-none transition-[background-color,color,box-shadow] motion-reduce:transition-none",
                  "hover:bg-white/10 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/30",
                  active && "bg-white text-black"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

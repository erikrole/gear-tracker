"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  SETTINGS_GROUP_ORDER,
  type SettingsSection,
} from "@/lib/nav-sections";

/**
 * ⌘K / Ctrl+K palette over the visible settings sections. Receives only the
 * sections the user is allowed to see, so search results match nav.
 */
export function SettingsCommand({ visibleSections }: { visibleSections: ReadonlyArray<SettingsSection> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      const isSlash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
      // Ignore "/" while typing in inputs/textareas/contenteditable.
      const target = e.target as HTMLElement | null;
      const inField = !!target && (
        target.tagName === "INPUT"
          || target.tagName === "TEXTAREA"
          || target.isContentEditable
      );
      if (isCmdK || (isSlash && !inField)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  // Group the visible sections in the configured order.
  const grouped = SETTINGS_GROUP_ORDER.map((group) => ({
    group,
    sections: visibleSections.filter((s) => s.group === group),
  })).filter((g) => g.sections.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Search settings"
      >
        <SearchIcon className="size-3.5" />
        <span>Search settings</span>
        <kbd className="ml-2 hidden md:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search settings — try 'allowlist', 'cron', 'home venue'…" />
        <CommandList>
          <CommandEmpty>No matching settings page.</CommandEmpty>
          {grouped.map(({ group, sections }) => (
            <CommandGroup key={group} heading={group}>
              {sections.map((s) => (
                <CommandItem
                  key={s.href}
                  value={`${s.label} ${s.description} ${(s.keywords ?? []).join(" ")}`}
                  onSelect={() => go(s.href)}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{s.description}</span>
                  </div>
                  <CommandShortcut>{s.href.replace("/settings/", "")}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

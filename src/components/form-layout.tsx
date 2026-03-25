import { CheckCircle2Icon } from "lucide-react";
import { Label } from "@/components/ui/label";

export function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-1">
      <Label className="pt-2.5 text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div>{children}</div>
    </div>
  );
}

export function FormRow2Col({
  label,
  required,
  children,
}: {
  label?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-1">
      <Label className="pt-2.5 text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
      {children}
    </h3>
  );
}

export function SuccessFlash({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
      <CheckCircle2Icon className="size-4 shrink-0" />
      {message}
    </div>
  );
}

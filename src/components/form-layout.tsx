import { CheckCircle2Icon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormRow({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const labelContent = (
    <>
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </>
  );

  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-1">
      {htmlFor ? (
        <Label htmlFor={htmlFor} className="pt-2.5 text-sm font-medium">
          {labelContent}
        </Label>
      ) : (
        <span className="pt-2.5 text-sm font-medium">
          {labelContent}
        </span>
      )}
      <div>{children}</div>
    </div>
  );
}

export function FormRow2Col({
  label,
  required,
  htmlFor,
  children,
}: {
  label?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const labelContent = (
    <>
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </>
  );

  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-1">
      {htmlFor ? (
        <Label htmlFor={htmlFor} className="pt-2.5 text-sm font-medium">
          {labelContent}
        </Label>
      ) : (
        <span className="pt-2.5 text-sm font-medium">
          {labelContent}
        </span>
      )}
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
    <Alert className="border-[var(--green)]/20 bg-[var(--green-bg)] text-[var(--green-text)]">
      <CheckCircle2Icon className="size-4 shrink-0" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

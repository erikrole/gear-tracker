import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import type { ScanMode, UnitPickerState } from "./types";

type UnitPickerSheetProps = {
  mode: ScanMode;
  unitPicker: UnitPickerState;
  selectedUnits: Set<number>;
  processing: boolean;
  onClose: () => void;
  onSelectUnits: (units: Set<number>) => void;
  onSubmit: () => void;
};

export function UnitPickerSheet({
  mode,
  unitPicker,
  selectedUnits,
  processing,
  onClose,
  onSelectUnits,
  onSubmit,
}: UnitPickerSheetProps) {
  return (
    <Sheet
      open={!!unitPicker}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Select {unitPicker?.name} units</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "checkout"
              ? "Which units are going out?"
              : "Which units came back?"}
          </p>
        </SheetHeader>

        <SheetBody className="px-6 py-4">
          {unitPicker && (
            <>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold">
                  {selectedUnits.size} of {unitPicker.availableUnits.length}{" "}
                  selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      selectedUnits.size === unitPicker.availableUnits.length
                    ) {
                      onSelectUnits(new Set());
                    } else {
                      onSelectUnits(new Set(unitPicker.availableUnits));
                    }
                  }}
                >
                  {selectedUnits.size === unitPicker.availableUnits.length
                    ? "Deselect all"
                    : "Select all"}
                </Button>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 max-h-[300px] overflow-y-auto pb-2">
                {unitPicker.availableUnits.map((num) => {
                  const isSelected = selectedUnits.has(num);
                  return (
                    <button
                      key={num}
                      onClick={() => {
                        const next = new Set(selectedUnits);
                        if (isSelected) next.delete(num);
                        else next.add(num);
                        onSelectUnits(next);
                      }}
                      className={`px-1 py-2 rounded-lg border-2 font-semibold cursor-pointer transition-all duration-100 ${
                        isSelected
                          ? "border-blue-500 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400"
                          : "border-border bg-background text-foreground"
                      }`}
                    >
                      #{num}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </SheetBody>

        <SheetFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 min-h-12"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={selectedUnits.size === 0 || processing}
            className="flex-1 min-h-12"
          >
            {processing ? (
              <>
                <Loader2Icon className="size-4 animate-spin mr-2" />
                Scanning...
              </>
            ) : (
              `Scan ${selectedUnits.size} unit${selectedUnits.size !== 1 ? "s" : ""}`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

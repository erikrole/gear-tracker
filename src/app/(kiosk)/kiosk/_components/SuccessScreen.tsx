"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  message: string;
  detail?: string;
  onDone: () => void;
};

export function SuccessScreen({ message, detail, onDone }: Props) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-6">
        <CheckCircle2 className="h-24 w-24 mx-auto text-green-500" />
        <h1 className="text-4xl font-bold">{message}</h1>
        {detail && (
          <p className="text-xl text-muted-foreground">{detail}</p>
        )}
        <p className="text-lg text-muted-foreground">
          Returning to home in {countdown}s...
        </p>
        <Button size="lg" variant="outline" onClick={onDone} className="h-14 px-8 text-lg">
          Done
        </Button>
      </div>
    </div>
  );
}

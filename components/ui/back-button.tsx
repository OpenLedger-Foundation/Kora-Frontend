"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();
  return (
    <Button variant="outline" onClick={() => router.back()} className="gap-2">
      <ArrowLeft className="h-3.5 w-3.5" /> Go Back
    </Button>
  );
}

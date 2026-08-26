"use client";

import { toast } from "sonner";

export function useToast() {
  return {
    success: (message: string) => toast.success(message),
    info: (message: string) => toast.info(message),
  };
}
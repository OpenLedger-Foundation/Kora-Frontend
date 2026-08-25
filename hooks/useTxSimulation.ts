"use client";

/**
 * useTxSimulation
 *
 * Provides a Promise-based gate that:
 *  1. Opens the TxSimulationPreview dialog when a simulation result arrives
 *  2. Resolves `true`  when the user clicks "Proceed & Sign"
 *  3. Resolves `false` when the user clicks "Cancel" or the dialog is dismissed
 *
 * Usage:
 *   const { simulationDialogProps, onSimulationPreview } = useTxSimulation();
 *
 *   await execute(buildFn, { onSimulationPreview });
 *
 *   // In JSX:
 *   <TxSimulationPreview {...simulationDialogProps} />
 */

import { useCallback, useRef, useState } from "react";
import type { SimulationPreview } from "./useTransaction";

interface SimulationDialogProps {
  open: boolean;
  preview: SimulationPreview | null;
  onProceed: () => void;
  onCancel: () => void;
}

export function useTxSimulation() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SimulationPreview | null>(null);

  // Holds the resolve function of the pending Promise
  const resolveRef = useRef<((proceed: boolean) => void) | null>(null);

  /**
   * Pass this as `options.onSimulationPreview` to `useTransaction().execute()`.
   * It opens the dialog, shows the preview, and waits for user action.
   */
  const onSimulationPreview = useCallback(
    (incoming: SimulationPreview): Promise<boolean> => {
      setPreview(incoming);
      setOpen(true);

      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
      });
    },
    []
  );

  const handleProceed = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setPreview(null);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const simulationDialogProps: SimulationDialogProps = {
    open,
    preview,
    onProceed: handleProceed,
    onCancel: handleCancel,
  };

  return { simulationDialogProps, onSimulationPreview };
}

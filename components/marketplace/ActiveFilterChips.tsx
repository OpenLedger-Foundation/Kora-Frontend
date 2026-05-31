import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ActiveFilterChips({ filters = [], onRemove, onClear }: any) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <AnimatePresence>
        {filters.map((f: any) => (
          <motion.div
            key={f.key}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-sm"
          >
            <span className="font-medium">{f.label}</span>
            <button type="button" onClick={() => onRemove(f.key)} className="text-muted-foreground">×</button>
          </motion.div>
        ))}
      </AnimatePresence>
      {filters.length > 0 && (
        <button type="button" onClick={onClear} className="ml-2 rounded-md px-3 py-1 text-sm bg-destructive/10 text-destructive">Clear All</button>
      )}
    </div>
  );
}

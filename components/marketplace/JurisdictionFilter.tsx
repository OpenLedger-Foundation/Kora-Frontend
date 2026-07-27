import React from "react";
import { JURISDICTIONS } from "./filters";
import { getJurisdictionFlag } from "@/lib/utils";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";

export default function JurisdictionFilter({ selected = [], onToggle }: any) {
  const { registerRef, handleKeyDown, getTabIndex, setActiveIndex } =
    useRovingTabIndex(JURISDICTIONS.length);

  return (
    <div>
      <h3 id="jurisdiction-filter-label" className="mb-2 text-sm font-medium text-foreground">
        Jurisdiction
      </h3>
      <div
        role="group"
        aria-labelledby="jurisdiction-filter-label"
        className="grid grid-cols-2 gap-2"
      >
        {JURISDICTIONS.map((j, index) => (
          <button
            key={j.code}
            ref={registerRef(index)}
            type="button"
            tabIndex={getTabIndex(index)}
            aria-pressed={selected.includes(j.code)}
            onClick={() => {
              setActiveIndex(index);
              onToggle(j.code);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${selected.includes(j.code) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <span className="text-lg" role="img" aria-label={j.name}>
              {getJurisdictionFlag(j.code)}
            </span>
            <span>{j.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

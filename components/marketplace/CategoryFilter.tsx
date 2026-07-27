import React from "react";
import { CATEGORIES } from "./filters";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";

export default function CategoryFilter({ selected = [], onToggle }: any) {
  const { registerRef, handleKeyDown, getTabIndex, setActiveIndex } =
    useRovingTabIndex(CATEGORIES.length);

  return (
    <div>
      <h3 id="category-filter-label" className="mb-2 text-sm font-medium text-foreground">
        Category
      </h3>
      <div
        role="group"
        aria-labelledby="category-filter-label"
        className="grid grid-cols-2 gap-2"
      >
        {CATEGORIES.map((c, index) => (
          <button
            key={c.key}
            ref={registerRef(index)}
            type="button"
            tabIndex={getTabIndex(index)}
            aria-pressed={selected.includes(c.key)}
            onClick={() => {
              setActiveIndex(index);
              onToggle(c.key);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${selected.includes(c.key) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <span className="text-lg">{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

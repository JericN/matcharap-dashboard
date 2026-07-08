"use client";
import { useState } from "react";
import FilterEditor from "./FilterEditor";
import SortEditor from "./SortEditor";
import HideFieldsMenu from "./HideFieldsMenu";

// The per-view toolbar: Filter · Sort · Hide fields. Each button shows a live
// count and goes `chip--active` when its view state is non-empty; clicking it
// anchors the matching editor to the button's rect. Only one popover is open at
// a time. The editors emit their slice of the view via onUpdateView — a partial
// { filters } / { sorts } / { hiddenColumnIds } merge.
export default function ViewToolbar({ view, columns, onUpdateView }) {
  const [open, setOpen] = useState(null); // "filter" | "sort" | "hide" | null
  const [rect, setRect] = useState(null);

  const filters = view.filters ?? [];
  const sorts = view.sorts ?? [];
  const hidden = view.hiddenColumnIds ?? [];

  const openPanel = (which, e) => {
    if (open === which) {
      setOpen(null);
      return;
    }
    setRect(e.currentTarget.getBoundingClientRect());
    setOpen(which);
  };
  const close = () => setOpen(null);

  const btn = (which, count, base, activeLabel) => (
    <button
      type="button"
      onClick={(ev) => openPanel(which, ev)}
      aria-pressed={count > 0}
      className={`chip text-[.64rem]${count > 0 ? " chip--active" : ""}`}
    >
      {count > 0 ? `${activeLabel} · ${count}` : base}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-[7px]">
      {btn("filter", filters.length, "Filter", "Filter")}
      {btn("sort", sorts.length, "Sort", "Sort")}
      {btn("hide", hidden.length, "Hide fields", "Hidden")}

      {open === "filter" && (
        <FilterEditor
          view={view}
          columns={columns}
          rect={rect}
          onClose={close}
          onChange={(nextFilters) => onUpdateView({ filters: nextFilters })}
        />
      )}
      {open === "sort" && (
        <SortEditor
          view={view}
          columns={columns}
          rect={rect}
          onClose={close}
          onChange={(nextSorts) => onUpdateView({ sorts: nextSorts })}
        />
      )}
      {open === "hide" && (
        <HideFieldsMenu
          view={view}
          columns={columns}
          rect={rect}
          onClose={close}
          onChange={(nextHidden) => onUpdateView({ hiddenColumnIds: nextHidden })}
        />
      )}
    </div>
  );
}

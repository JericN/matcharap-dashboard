"use client";
// The reusable config panel for link/lookup/rollup columns. Rendered inside
// AddColumnPopover (create) and ColumnMenu (edit). `mode` picks the slice:
// "link" = target-table select + single-record checkbox (v1, unchanged);
// "lookup" = a link-field select + a target-field select (Stage 3);
// "rollup" = a link-field select + an aggregation select + (unless count) a
// target-field select (Stage 4). lookup/rollup share the same linkColumns/
// targetColumns derivation, hoisted here so both modes reuse it.
export default function LinkFieldConfig({ mode = "link", tables, currentTabId, columns = [], draft, setDraft }) {
  const linkColumns = columns.filter((c) => c.type === "link");
  const linkCol = columns.find((c) => c.id === draft.linkColumnId);
  const targetTable = tables.find((t) => t.id === linkCol?.link?.tableId);
  const targetColumns = (targetTable?.columns ?? []).filter(
    (c) => c.type !== "link" && c.type !== "lookup" && c.type !== "rollup",
  );

  if (mode === "lookup" || mode === "rollup") {
    const linkFieldSelect = (
      <>
        <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Through link</div>
        {linkColumns.length === 0 ? (
          <div className="px-2 py-1.5 font-mono text-[.64rem] text-clay">Add a link field first.</div>
        ) : (
          <select
            value={draft.linkColumnId ?? ""}
            onChange={(e) => setDraft({ ...draft, linkColumnId: e.target.value, targetColumnId: "" })}
            className="field-select w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
          >
            <option value="" disabled>
              Choose a link field…
            </option>
            {linkColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </>
    );

    if (mode === "lookup") {
      return (
        <div className="mt-1">
          {linkFieldSelect}
          <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Field to show</div>
          <select
            value={draft.targetColumnId ?? ""}
            onChange={(e) => setDraft({ ...draft, targetColumnId: e.target.value })}
            disabled={!draft.linkColumnId}
            className="field-select w-full py-[6px] px-[10px] text-[.7rem] disabled:opacity-40"
          >
            <option value="" disabled>
              Choose a field…
            </option>
            {targetColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // mode === "rollup"
    const fn = draft.fn ?? "count";
    return (
      <div className="mt-1">
        {linkFieldSelect}
        <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Aggregate</div>
        <select
          value={fn}
          onChange={(e) => setDraft({ ...draft, fn: e.target.value })}
          className="field-select w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
        >
          {["count", "sum", "avg", "min", "max"].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {fn !== "count" && (
          <>
            <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Number field</div>
            <select
              value={draft.targetColumnId ?? ""}
              onChange={(e) => setDraft({ ...draft, targetColumnId: e.target.value })}
              disabled={!draft.linkColumnId}
              className="field-select w-full py-[6px] px-[10px] text-[.7rem] disabled:opacity-40"
            >
              <option value="" disabled>
                Choose a field…
              </option>
              {targetColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    );
  }

  const others = tables.filter((t) => t.id !== currentTabId); // no self-links in v1
  return (
    <div className="mt-1">
      <div className="font-mono text-[.53rem] uppercase tracking-[.1em] text-brown-soft px-1 mb-1">Link to table</div>
      {others.length === 0 ? (
        <div className="px-2 py-1.5 font-mono text-[.64rem] text-clay">Create another sheet first.</div>
      ) : (
        <select
          value={draft.tableId ?? ""}
          onChange={(e) => setDraft({ ...draft, tableId: e.target.value })}
          className="field-select w-full mb-2 py-[6px] px-[10px] text-[.7rem]"
        >
          <option value="" disabled>
            Choose a table…
          </option>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 px-1 font-mono text-[.66rem] text-forest cursor-pointer">
        <input
          type="checkbox"
          checked={!!draft.single}
          onChange={(e) => setDraft({ ...draft, single: e.target.checked })}
        />
        Limit to a single record
      </label>
    </div>
  );
}

"use client";
// The reusable config panel for link/lookup/rollup columns. Rendered inside
// AddColumnPopover (create) and ColumnMenu (edit). This slice = LINK mode.
export default function LinkFieldConfig({ tables, currentTabId, draft, setDraft }) {
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

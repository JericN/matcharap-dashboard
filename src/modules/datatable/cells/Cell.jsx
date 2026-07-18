"use client";
import TextCell from "./TextCell";
import NumberCell from "./NumberCell";
import DateCell from "./DateCell";
import SelectCell from "./SelectCell";
import MultiSelectCell from "./MultiSelectCell";
import CheckboxCell from "./CheckboxCell";
import LinkCell from "./LinkCell";
import LookupCell from "./LookupCell";
import RollupCell from "./RollupCell";

// Dispatch a cell to the right editor by column type. Simple types use
// (value,onCommit); linked types use (row,ctx,link) for cross-table resolution.
export default function Cell({ column, value, row, ctx, link, onCommit, onCreateOption }) {
  switch (column.type) {
    case "number":
      return <NumberCell column={column} value={value} onCommit={onCommit} />;
    case "date":
      return <DateCell value={value} onCommit={onCommit} />;
    case "select":
      return <SelectCell column={column} value={value} onCommit={onCommit} onCreateOption={onCreateOption} />;
    case "multiSelect":
      return <MultiSelectCell column={column} value={value} onCommit={onCommit} onCreateOption={onCreateOption} />;
    case "checkbox":
      return <CheckboxCell value={value} onCommit={onCommit} />;
    case "link":
      return <LinkCell column={column} row={row} ctx={ctx} link={link} />;
    case "lookup":
      return <LookupCell column={column} row={row} ctx={ctx} />;
    case "rollup":
      return <RollupCell column={column} row={row} ctx={ctx} />;
    case "text":
    default:
      return <TextCell value={value} onCommit={onCommit} />;
  }
}

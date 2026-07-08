"use client";
import TextCell from "./TextCell";
import NumberCell from "./NumberCell";
import DateCell from "./DateCell";
import SelectCell from "./SelectCell";
import MultiSelectCell from "./MultiSelectCell";
import CheckboxCell from "./CheckboxCell";

// Dispatch a cell to the right editor by column type. `onCommit(value)` writes the
// (already typed) value for this cell; `onCreateOption(name)` (select types) mints
// + returns a new option.
export default function Cell({ column, value, onCommit, onCreateOption }) {
  switch (column.type) {
    case "number":
      return <NumberCell column={column} value={value} onCommit={onCommit} />;
    case "date":
      return <DateCell value={value} onCommit={onCommit} />;
    case "select":
      return (
        <SelectCell column={column} value={value} onCommit={onCommit} onCreateOption={onCreateOption} />
      );
    case "multiSelect":
      return (
        <MultiSelectCell column={column} value={value} onCommit={onCommit} onCreateOption={onCreateOption} />
      );
    case "checkbox":
      return <CheckboxCell value={value} onCommit={onCommit} />;
    case "text":
    default:
      return <TextCell value={value} onCommit={onCommit} />;
  }
}

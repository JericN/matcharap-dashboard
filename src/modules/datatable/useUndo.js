"use client";
import { useCallback, useReducer, useRef } from "react";

// Per-browser undo/redo of inverse commands. The stacks live in refs so a
// command's undo()/redo() side-effect never runs inside a React state updater
// (which StrictMode double-invokes); a counter forces a re-render for button
// state. A command = { undo: ()=>void, redo: ()=>void, label: string }.
const CAP = 50;

export default function useUndo() {
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const [, force] = useReducer((x) => x + 1, 0);

  const push = useCallback((cmd) => {
    undoRef.current = [...undoRef.current, cmd].slice(-CAP);
    redoRef.current = [];
    force();
  }, []);

  const undo = useCallback(() => {
    const s = undoRef.current;
    if (!s.length) return;
    const cmd = s[s.length - 1];
    undoRef.current = s.slice(0, -1);
    redoRef.current = [...redoRef.current, cmd];
    cmd.undo();
    force();
  }, []);

  const redo = useCallback(() => {
    const r = redoRef.current;
    if (!r.length) return;
    const cmd = r[r.length - 1];
    redoRef.current = r.slice(0, -1);
    undoRef.current = [...undoRef.current, cmd].slice(-CAP);
    cmd.redo();
    force();
  }, []);

  return {
    push,
    undo,
    redo,
    canUndo: undoRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
    undoLabel: undoRef.current[undoRef.current.length - 1]?.label,
    redoLabel: redoRef.current[redoRef.current.length - 1]?.label,
  };
}

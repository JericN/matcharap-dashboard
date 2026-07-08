// Public entry for the use-agnostic DataTable module. ONLY the client component is
// exported here — the pure cores (model.mjs / viewModel.mjs) must be imported via
// their DEEP paths so a server consumer never pulls react/tanstack/dnd-kit through
// this barrel.
export { default as DataTable } from "./DataTable";

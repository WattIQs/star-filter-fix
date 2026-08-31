export function HudRuntime() {
  // Intentionally empty: the shared loading-state.css owns the generic loader.
  // Keeping this runtime free of visual overrides prevents duplicated/legacy
  // radar artwork from replacing the application's standard spinner.
  return null;
}

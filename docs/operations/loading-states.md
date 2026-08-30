# Loading-state contract

The area-search loading state must be driven by the actual scan lifecycle and must not depend on global HUD observers, pointer loops, or remote animation assets. The UI must always clear the state on success, failure, and cancellation.

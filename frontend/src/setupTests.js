// Adds jest-dom's custom matchers (toBeInTheDocument, toHaveValue, etc.)
// to Vitest's expect, so component tests can make readable assertions
// about rendered DOM.
//
// Using the /vitest subpath instead of the package root: the root entry
// point assumes Jest's global `expect`, which Vitest doesn't inject
// unless you turn on `test.globals` in vite.config.js. The /vitest entry
// extends Vitest's own `expect` directly, so no globals flag is needed.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library normally unmounts each rendered component after
// its test automatically, but that auto-detection didn't kick in here
// (we're not running with `test.globals: true`). Without this, every
// `render(<App />)` in a test file stacks on top of the last one instead
// of replacing it, so later tests see duplicate elements from earlier
// renders still sitting in the DOM. Calling cleanup() after every test
// unmounts and clears the DOM explicitly.
afterEach(() => {
  cleanup();
});

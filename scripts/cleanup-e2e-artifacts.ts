/**
 * Manual E2E artifact cleanup — same logic as Playwright globalTeardown.
 * Usage: bun run test:e2e:cleanup
 */
import { runE2eArtifactCleanup } from "../e2e/utils/cleanup-artifacts";

runE2eArtifactCleanup();

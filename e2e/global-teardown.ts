/**
 * Playwright global teardown — always clean local E2E artifacts after a run.
 */
import { runE2eArtifactCleanup } from "./utils/cleanup-artifacts";

export default async function globalTeardown() {
  runE2eArtifactCleanup();
}

import {
  getLogger,
  initLogging,
  resetLoggingForTests,
  shutdownLoggingAsync,
  type LoggingInitOptions,
} from "../../../src/platform/logging/index.js";
import { createTestTempDir } from "../../test-temp-dir.js";

export async function withTestLogging(
  options: Omit<LoggingInitOptions, "logDirectory">,
  run: (logDirectory: string) => void | Promise<void>,
): Promise<string> {
  const logDirectory = createTestTempDir("c2a-log-");
  initLogging({ ...options, logDirectory });
  try {
    await run(logDirectory);
    getLogger("test.cleanup").info("test cleanup");
    await shutdownLoggingAsync();
    return logDirectory;
  } finally {
    resetLoggingForTests();
  }
}

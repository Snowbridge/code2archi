import { getRootLogger, isLoggingInitialized } from "./init-logging.js";

export function shutdownLogging(): void {
  if (!isLoggingInitialized()) {
    return;
  }

  const logger = getRootLogger();
  for (const transport of logger.transports) {
    if (typeof transport.close === "function") {
      transport.close();
    }
  }
}

export async function shutdownLoggingAsync(): Promise<void> {
  if (!isLoggingInitialized()) {
    return;
  }

  const logger = getRootLogger();
  await new Promise<void>((resolve) => {
    logger.on("finish", resolve);
    logger.end();
  });
}

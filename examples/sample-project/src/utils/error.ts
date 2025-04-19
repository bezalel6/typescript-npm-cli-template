import { logger } from './logger';

export function handleError(error: unknown) {
  if (error instanceof Error) {
    logger.error(`Error occurred: ${error.message}`);
  } else {
    logger.error(`Unknown error occurred: ${String(error)}`);
  }
}
 
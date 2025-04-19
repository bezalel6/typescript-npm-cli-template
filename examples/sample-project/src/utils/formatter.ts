/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { logger } from './logger';

export function formatData(data: any) {
  logger.debug('Formatting data');
  
  if (!data) {
    return null;
  }
  
  return {
    ...data,
    formattedAt: new Date().toISOString()
  };
}

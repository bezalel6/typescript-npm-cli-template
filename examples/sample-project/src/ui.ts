import { logger } from './utils/logger';

export function renderUI(data: any) {
  logger.info('Rendering UI with data');
  console.log('UI rendered with:', data);
  return true;
}

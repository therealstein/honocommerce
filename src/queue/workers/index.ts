/**
 * Queue Workers Index
 * Exports all workers and provides start/stop functions
 */

export { startWebhookWorker, stopWebhookWorker } from './webhook.worker';
export { startEmailWorker, stopEmailWorker } from './email.worker';
export { startOrderWorker, stopOrderWorker } from './order.worker';

import { startWebhookWorker, stopWebhookWorker } from './webhook.worker';
import { startEmailWorker, stopEmailWorker } from './email.worker';
import { startOrderWorker, stopOrderWorker } from './order.worker';
import logger from '../../lib/logger';

/**
 * Start all workers
 */
export const startAllWorkers = (): void => {
  logger.info('Starting queue workers');
  startWebhookWorker();
  startEmailWorker();
  startOrderWorker();
};

/**
 * Stop all workers
 */
export const stopAllWorkers = async (): Promise<void> => {
  logger.info('Stopping queue workers');
  await Promise.all([
    stopWebhookWorker(),
    stopEmailWorker(),
    stopOrderWorker(),
  ]);
};

export default {
  startAll: startAllWorkers,
  stopAll: stopAllWorkers,
};

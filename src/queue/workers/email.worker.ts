/**
 * Email Worker
 * Processes email jobs from BullMQ or memory queue
 */

import { Worker, Job } from 'bullmq';
import { 
  connection, 
  QUEUE_NAMES, 
  isQueueEnabled,
  registerMemoryWorker,
} from '../index';
import logger from '../../lib/logger';

interface EmailJobData {
  type: string;
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, unknown>;
}

let worker: Worker<EmailJobData> | null = null;

// Counter for simulated emails (for memory queue)
let emailCounter = 0;

/**
 * Process email job
 * 
 * Note: This is a placeholder implementation.
 * In production, integrate with an email service like:
 * - SendGrid
 * - AWS SES
 * - Mailgun
 * - Resend
 * - Nodemailer (SMTP)
 */
const processEmail = async (data: EmailJobData): Promise<void> => {
  const { to, subject, template, type } = data;
  
  logger.info('Processing email', { type, to, subject, template });
  
  // TODO: Integrate with email service
  // Example:
  // if (process.env.SENDGRID_API_KEY) {
  //   await sendgrid.send({ to, subject, template, data });
  // } else if (process.env.AWS_SES_REGION) {
  //   await ses.sendEmail({ to, subject, body });
  // }
  
  emailCounter++;
};

/**
 * Start the email worker
 */
export const startEmailWorker = (): void => {
  registerMemoryWorker(QUEUE_NAMES.EMAIL, async (data) => {
    try {
      await processEmail(data as EmailJobData);
    } catch (error) {
      logger.error('Memory queue email failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  if (!isQueueEnabled() || !connection) {
    logger.info('Email worker started', { backend: 'memory' });
    return;
  }

  worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      await processEmail(job.data);
      return { success: true, messageId: job.id };
    },
    {
      connection,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    logger.info('Email sent', { jobId: job.id, to: job.data.to });
  });

  worker.on('failed', (job, err) => {
    logger.error('Email failed', { 
      jobId: job?.id, 
      error: err.message 
    });
  });

  worker.on('error', (err) => {
    logger.error('Email worker error', { error: err.message });
  });

  logger.info('Email worker started', { backend: 'redis' });
};

/**
 * Stop the email worker
 */
export const stopEmailWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Email worker stopped');
  }
};

/**
 * Get email counter (for testing)
 */
export const getEmailCounter = (): number => emailCounter;

export default {
  start: startEmailWorker,
  stop: stopEmailWorker,
  getEmailCounter,
};

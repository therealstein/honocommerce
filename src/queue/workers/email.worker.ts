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

interface EmailJobData {
  type: string;
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, unknown>;
}

let worker: Worker<EmailJobData> | null = null;

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
  
  console.log(`📧 Email [${type}]`);
  console.log(`   To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Template: ${template ?? 'none'}`);
  
  // TODO: Integrate with email service
  // Example:
  // if (process.env.SENDGRID_API_KEY) {
  //   await sendgrid.send({ to, subject, template, data });
  // } else if (process.env.AWS_SES_REGION) {
  //   await ses.sendEmail({ to, subject, body });
  // }
  
  console.log(`   ✅ Email sent (simulated)`);
};

/**
 * Start the email worker
 */
export const startEmailWorker = (): void => {
  // Always register handler for memory queue fallback
  registerMemoryWorker(QUEUE_NAMES.EMAIL, async (data) => {
    try {
      await processEmail(data as EmailJobData);
    } catch (error) {
      console.error('Memory queue email failed:', error);
    }
  });

  if (!isQueueEnabled() || !connection) {
    console.log('📦 Email worker using in-memory queue');
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

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Email sent: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Email failed: ${job?.id}`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Email worker error:', err);
  });

  console.log('🔄 Email worker started (Redis)');
};

/**
 * Stop the email worker
 */
export const stopEmailWorker = async (): Promise<void> => {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Email worker stopped');
  }
};

export default {
  start: startEmailWorker,
  stop: stopEmailWorker,
};

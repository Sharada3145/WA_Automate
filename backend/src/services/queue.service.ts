// src/services/queue.service.ts
import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { env } from '../config/env';
import { processCampaignJob } from '../workers/campaignWorker';

export interface CampaignJobData {
  campaignId: number;
  contactId: number;
  campaignContactId: number;
  idempotencyKey: string;
}

export interface EnqueueJobItem {
  name: string;
  data: CampaignJobData;
  opts?: { jobId?: string };
}

export interface ICampaignQueue {
  addBulk(jobs: EnqueueJobItem[]): Promise<any>;
  add(name: string, data: CampaignJobData, opts?: any): Promise<any>;
}

class MockQueueAdapter implements ICampaignQueue {
  private queue: EnqueueJobItem[] = [];
  private isProcessing = false;

  async addBulk(jobs: EnqueueJobItem[]): Promise<any> {
    console.log(`[MockQueue] Enqueued ${jobs.length} jobs to in-memory queue`);
    this.queue.push(...jobs);
    await this.processNext();
    return jobs.map((j, i) => ({ id: j.opts?.jobId || `mock-job-${Date.now()}-${i}` }));
  }

  async add(name: string, data: CampaignJobData, opts?: any): Promise<any> {
    console.log(`[MockQueue] Enqueued 1 job (${name}) to in-memory queue`);
    const jobItem = { name, data, opts };
    this.queue.push(jobItem);
    await this.processNext();
    return { id: opts?.jobId || `mock-job-${Date.now()}` };
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      try {
        console.log(`[MockWorker] Processing job for campaign ${job.data.campaignId}, contact ${job.data.contactId}`);
        await processCampaignJob(job.data);
        console.log(`[MockWorker] Job for campaign ${job.data.campaignId} completed successfully`);
      } catch (err: any) {
        console.error(`[MockWorker] Job for campaign ${job.data.campaignId} failed:`, err.message);
      }
    }

    this.isProcessing = false;
  }
}

class BullMQQueueAdapter implements ICampaignQueue {
  private bullQueue: Queue;

  constructor() {
    this.bullQueue = new Queue('campaign-queue', {
      connection: getRedisConnection() as any
    });
  }

  async addBulk(jobs: EnqueueJobItem[]): Promise<any> {
    return this.bullQueue.addBulk(jobs as any);
  }

  async add(name: string, data: CampaignJobData, opts?: any): Promise<any> {
    return this.bullQueue.add(name, data, opts);
  }
}

let campaignQueueInstance: ICampaignQueue;

export function getCampaignQueue(): ICampaignQueue {
  if (campaignQueueInstance) return campaignQueueInstance;

  if (env.useMockRedis) {
    campaignQueueInstance = new MockQueueAdapter();
  } else {
    campaignQueueInstance = new BullMQQueueAdapter();
  }

  return campaignQueueInstance;
}

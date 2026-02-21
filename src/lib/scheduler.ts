/**
 * Scheduler System
 * Handles cron-like scheduling and interval-based tasks for plugins
 */

import { db } from '../db';
import { pluginSchedules } from '../db/schema/plugins';
import { eq, and } from 'drizzle-orm';
import type { PluginContext, ScheduleHandler } from '../types/plugin.types';

// ============== SCHEDULED TASK ==============

interface ScheduledTask {
  id: string;
  pluginId: string;
  scheduleId: string;
  handler: ScheduleHandler;
  context: PluginContext;
  intervalId: NodeJS.Timeout | null;
  cronExpression: string | null;
  intervalMs: number | null;
  nextRun: Date | null;
  isEnabled: boolean;
}

// ============== SCHEDULER MANAGER ==============

class SchedulerManager {
  private tasks: Map<string, ScheduledTask> = new Map();
  private isRunning: boolean = false;
  private mainIntervalId: NodeJS.Timeout | null = null;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Run the scheduler tick every minute
    this.mainIntervalId = setInterval(() => {
      this.tick();
    }, 60000); // Check every minute
    
    // Also run immediately
    this.tick();
    
    console.log('📅 Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.mainIntervalId) {
      clearInterval(this.mainIntervalId);
      this.mainIntervalId = null;
    }
    
    // Clear all task intervals
    for (const task of this.tasks.values()) {
      if (task.intervalId) {
        clearInterval(task.intervalId);
      }
    }
    
    this.tasks.clear();
    
    console.log('📅 Scheduler stopped');
  }

  /**
   * Register a scheduled task
   */
  async register(
    pluginId: string,
    scheduleId: string,
    schedule: string,
    handler: ScheduleHandler,
    context: PluginContext
  ): Promise<void> {
    const taskId = `${pluginId}:${scheduleId}`;
    
    // Parse the schedule
    const { cronExpression, intervalMs } = this.parseSchedule(schedule);
    
    // Calculate next run time
    const nextRun = this.calculateNextRun(cronExpression, intervalMs);
    
    // Create task
    const task: ScheduledTask = {
      id: taskId,
      pluginId,
      scheduleId,
      handler,
      context,
      intervalId: null,
      cronExpression,
      intervalMs,
      nextRun,
      isEnabled: true,
    };
    
    // If it's an interval-based schedule with less than 1 minute, use setInterval
    if (intervalMs && intervalMs < 60000) {
      task.intervalId = setInterval(() => {
        this.executeTask(task);
      }, intervalMs);
    }
    
    this.tasks.set(taskId, task);
    
    // Persist to database
    await this.persistSchedule(pluginId, scheduleId, cronExpression, intervalMs, nextRun);
    
    console.log(`📅 Registered schedule: ${taskId} (${schedule})`);
  }

  /**
   * Unregister a scheduled task
   */
  async unregister(pluginId: string, scheduleId: string): Promise<void> {
    const taskId = `${pluginId}:${scheduleId}`;
    const task = this.tasks.get(taskId);
    
    if (task) {
      if (task.intervalId) {
        clearInterval(task.intervalId);
      }
      this.tasks.delete(taskId);
    }
    
    // Remove from database
    await db
      .delete(pluginSchedules)
      .where(and(
        eq(pluginSchedules.pluginId, pluginId),
        eq(pluginSchedules.scheduleId, scheduleId)
      ));
    
    console.log(`📅 Unregistered schedule: ${taskId}`);
  }

  /**
   * Unregister all tasks for a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const tasksToRemove: string[] = [];
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.pluginId === pluginId) {
        if (task.intervalId) {
          clearInterval(task.intervalId);
        }
        tasksToRemove.push(taskId);
      }
    }
    
    for (const taskId of tasksToRemove) {
      this.tasks.delete(taskId);
    }
    
    // Remove from database
    await db
      .delete(pluginSchedules)
      .where(eq(pluginSchedules.pluginId, pluginId));
    
    console.log(`📅 Unregistered all schedules for plugin: ${pluginId}`);
  }

  /**
   * Enable/disable a scheduled task
   */
  async setEnabled(pluginId: string, scheduleId: string, enabled: boolean): Promise<void> {
    const taskId = `${pluginId}:${scheduleId}`;
    const task = this.tasks.get(taskId);
    
    if (task) {
      task.isEnabled = enabled;
      
      await db
        .update(pluginSchedules)
        .set({ isEnabled: enabled })
        .where(and(
          eq(pluginSchedules.pluginId, pluginId),
          eq(pluginSchedules.scheduleId, scheduleId)
        ));
    }
  }

  /**
   * Run a scheduled task manually
   */
  async runNow(pluginId: string, scheduleId: string): Promise<void> {
    const taskId = `${pluginId}:${scheduleId}`;
    const task = this.tasks.get(taskId);
    
    if (task) {
      await this.executeTask(task);
    }
  }

  /**
   * Get all scheduled tasks for a plugin
   */
  getPluginSchedules(pluginId: string): ScheduledTask[] {
    const result: ScheduledTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.pluginId === pluginId) {
        result.push(task);
      }
    }
    return result;
  }

  /**
   * Get all scheduled tasks
   */
  getAllSchedules(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Scheduler tick - check for tasks that need to run
   */
  private async tick(): Promise<void> {
    const now = new Date();
    
    for (const task of this.tasks.values()) {
      if (!task.isEnabled || !task.nextRun) continue;
      if (task.intervalMs && task.intervalMs < 60000) continue; // Handled by setInterval
      
      if (task.nextRun <= now) {
        await this.executeTask(task);
        
        // Calculate next run
        task.nextRun = this.calculateNextRun(task.cronExpression, task.intervalMs);
        
        // Update database
        await db
          .update(pluginSchedules)
          .set({ nextRun: task.nextRun })
          .where(and(
            eq(pluginSchedules.pluginId, task.pluginId),
            eq(pluginSchedules.scheduleId, task.scheduleId)
          ));
      }
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const taskId = task.id;
    
    try {
      // Mark as running
      await db
        .update(pluginSchedules)
        .set({ isRunning: true })
        .where(and(
          eq(pluginSchedules.pluginId, task.pluginId),
          eq(pluginSchedules.scheduleId, task.scheduleId)
        ));
      
      console.log(`📅 Executing schedule: ${taskId}`);
      
      // Execute handler
      await task.handler(task.context);
      
      // Update last run time
      const lastRun = new Date();
      task.nextRun = this.calculateNextRun(task.cronExpression, task.intervalMs);
      
      await db
        .update(pluginSchedules)
        .set({ 
          lastRun, 
          nextRun: task.nextRun,
          isRunning: false 
        })
        .where(and(
          eq(pluginSchedules.pluginId, task.pluginId),
          eq(pluginSchedules.scheduleId, task.scheduleId)
        ));
      
    } catch (error) {
      console.error(`📅 Error executing schedule ${taskId}:`, error);
      
      // Mark as not running
      await db
        .update(pluginSchedules)
        .set({ isRunning: false })
        .where(and(
          eq(pluginSchedules.pluginId, task.pluginId),
          eq(pluginSchedules.scheduleId, task.scheduleId)
        ));
    }
  }

  /**
   * Parse a schedule string into cron expression or interval
   */
  private parseSchedule(schedule: string): { cronExpression: string | null; intervalMs: number | null } {
    // Check if it's an interval (e.g., "5m", "1h", "30s")
    const intervalMatch = schedule.match(/^(\d+)(s|m|h|d)$/);
    if (intervalMatch) {
      const value = parseInt(intervalMatch[1], 10);
      const unit = intervalMatch[2];
      
      let intervalMs: number;
      switch (unit) {
        case 's':
          intervalMs = value * 1000;
          break;
        case 'm':
          intervalMs = value * 60 * 1000;
          break;
        case 'h':
          intervalMs = value * 60 * 60 * 1000;
          break;
        case 'd':
          intervalMs = value * 24 * 60 * 60 * 1000;
          break;
        default:
          intervalMs = value * 60 * 1000;
      }
      
      return { cronExpression: null, intervalMs };
    }
    
    // Otherwise, treat as cron expression
    return { cronExpression: schedule, intervalMs: null };
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(cronExpression: string | null, intervalMs: number | null): Date {
    const now = new Date();
    
    if (intervalMs) {
      return new Date(now.getTime() + intervalMs);
    }
    
    if (cronExpression) {
      return this.calculateNextCronRun(cronExpression, now);
    }
    
    // Default to 1 minute from now
    return new Date(now.getTime() + 60000);
  }

  /**
   * Calculate next run time from cron expression
   * Simple implementation supporting: minute hour day month weekday
   */
  private calculateNextCronRun(expression: string, from: Date): Date {
    const parts = expression.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      // Invalid cron, default to 1 minute
      return new Date(from.getTime() + 60000);
    }
    
    const [minute, hour, day, month, weekday] = parts;
    
    // Start from next minute
    const next = new Date(from);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    
    // Simple implementation: check next 1000 minutes for a match
    for (let i = 0; i < 1000; i++) {
      if (this.cronMatches(next, minute, hour, day, month, weekday)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }
    
    // Fallback
    return new Date(from.getTime() + 60000);
  }

  /**
   * Check if a date matches a cron expression
   */
  private cronMatches(
    date: Date,
    minute: string,
    hour: string,
    day: string,
    month: string,
    weekday: string
  ): boolean {
    const m = date.getMinutes();
    const h = date.getHours();
    const d = date.getDate();
    const mon = date.getMonth() + 1;
    const wd = date.getDay();
    
    return (
      this.cronFieldMatches(m, minute, 0, 59) &&
      this.cronFieldMatches(h, hour, 0, 23) &&
      this.cronFieldMatches(d, day, 1, 31) &&
      this.cronFieldMatches(mon, month, 1, 12) &&
      this.cronFieldMatches(wd, weekday, 0, 6)
    );
  }

  /**
   * Check if a value matches a cron field
   */
  private cronFieldMatches(value: number, field: string, min: number, max: number): boolean {
    if (field === '*') return true;
    
    // Handle step (e.g., */5)
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      return value % step === 0;
    }
    
    // Handle list (e.g., 1,3,5)
    if (field.includes(',')) {
      const values = field.split(',').map(v => parseInt(v, 10));
      return values.includes(value);
    }
    
    // Handle range (e.g., 1-5)
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(v => parseInt(v, 10));
      return value >= start && value <= end;
    }
    
    // Handle exact value
    return parseInt(field, 10) === value;
  }

  /**
   * Persist schedule to database
   */
  private async persistSchedule(
    pluginId: string,
    scheduleId: string,
    cronExpression: string | null,
    intervalMs: number | null,
    nextRun: Date | null
  ): Promise<void> {
    try {
      // Try to insert, or update if exists
      const existing = await db
        .select()
        .from(pluginSchedules)
        .where(and(
          eq(pluginSchedules.pluginId, pluginId),
          eq(pluginSchedules.scheduleId, scheduleId)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(pluginSchedules).values({
          pluginId,
          scheduleId,
          cronExpression,
          intervalMs,
          nextRun,
          isRunning: false,
          isEnabled: true,
        });
      } else {
        await db
          .update(pluginSchedules)
          .set({
            cronExpression,
            intervalMs,
            nextRun,
            isEnabled: true,
          })
          .where(and(
            eq(pluginSchedules.pluginId, pluginId),
            eq(pluginSchedules.scheduleId, scheduleId)
          ));
      }
    } catch (error) {
      console.error(`Failed to persist schedule ${pluginId}:${scheduleId}:`, error);
    }
  }

  /**
   * Restore schedules from database (called on startup)
   */
  async restoreSchedules(): Promise<void> {
    try {
      const schedules = await db.select().from(pluginSchedules);
      console.log(`📅 Found ${schedules.length} persisted schedules`);
      // Note: Actual handler restoration requires plugin manager integration
    } catch (error) {
      console.error('Failed to restore schedules:', error);
    }
  }
}

// Singleton instance
export const schedulerManager = new SchedulerManager();

// ============== CONVENIENCE FUNCTIONS ==============

export const startScheduler = (): void => schedulerManager.start();
export const stopScheduler = (): void => schedulerManager.stop();
export const registerSchedule = (
  pluginId: string,
  scheduleId: string,
  schedule: string,
  handler: ScheduleHandler,
  context: PluginContext
): Promise<void> => schedulerManager.register(pluginId, scheduleId, schedule, handler, context);
export const unregisterSchedule = (pluginId: string, scheduleId: string): Promise<void> => 
  schedulerManager.unregister(pluginId, scheduleId);
export const unregisterPluginSchedules = (pluginId: string): Promise<void> => 
  schedulerManager.unregisterPlugin(pluginId);

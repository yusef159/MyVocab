import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import path from 'path';
import { unlink, writeFile } from 'fs/promises';
import {
  exportFullBackup,
  getBackupScheduleConfig,
  getDueBackupScheduleConfigs,
  saveBackupScheduleConfig,
  setBackupScheduleActive,
  updateBackupScheduleNextRun,
  type AutoScheduleCadence,
  type BackupScheduleConfig,
} from '../db/index.js';
import { computeNextRunAt } from './autoWordScheduler.js';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_TIME_OF_DAY = '03:00';
const SCHEDULER_TICK_MS = 60_000;
const DEFAULT_GDRIVE_DESTINATION = 'gdrive:Raspberry Pi/MyVocab/myvocab-backup.json';

let schedulerTimer: NodeJS.Timeout | null = null;
const runningScheduleIds = new Set<string>();

function nowIso(): string {
  return new Date().toISOString();
}

function getBackupDestinationFallback(): string {
  return process.env.BACKUP_GDRIVE_DEST?.trim() || DEFAULT_GDRIVE_DESTINATION;
}

async function performBackup(destination: string): Promise<void> {
  const tempFilePath = path.join(tmpdir(), `myvocab-backup-${Date.now()}.json`);

  try {
    const payload = exportFullBackup();
    await writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');

    await execFileAsync('rclone', ['copyto', tempFilePath, destination], {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

async function runSchedule(config: BackupScheduleConfig): Promise<void> {
  if (runningScheduleIds.has(config.id)) {
    return;
  }
  runningScheduleIds.add(config.id);

  const destination = config.destinationPath?.trim() || getBackupDestinationFallback();

  try {
    await performBackup(destination);
  } catch (error) {
    console.error('Auto backup run failed:', error);
  } finally {
    const nextRunAt = computeNextRunAt(config, new Date());
    updateBackupScheduleNextRun(nextRunAt);
    runningScheduleIds.delete(config.id);
  }
}

export async function runBackupNow(
  destinationPath?: string
): Promise<{ destination: string; completedAt: string }> {
  const destination =
    destinationPath?.trim() ||
    getBackupScheduleConfig()?.destinationPath?.trim() ||
    getBackupDestinationFallback();

  await performBackup(destination);

  return { destination, completedAt: nowIso() };
}

export function saveBackupSchedule(input: {
  cadence: AutoScheduleCadence;
  timezone: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  destinationPath: string;
  active: boolean;
}): BackupScheduleConfig {
  const nextRunAt = computeNextRunAt(
    {
      cadence: input.cadence,
      timezone: input.timezone || DEFAULT_TIMEZONE,
      timeOfDay: input.timeOfDay || DEFAULT_TIME_OF_DAY,
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
    },
    new Date()
  );

  return saveBackupScheduleConfig({
    cadence: input.cadence,
    timezone: input.timezone || DEFAULT_TIMEZONE,
    timeOfDay: input.timeOfDay || DEFAULT_TIME_OF_DAY,
    dayOfWeek: input.dayOfWeek,
    dayOfMonth: input.dayOfMonth,
    destinationPath: input.destinationPath?.trim() || getBackupDestinationFallback(),
    nextRunAt,
    active: input.active,
  });
}

export function toggleBackupSchedule(active: boolean): BackupScheduleConfig | null {
  const updated = setBackupScheduleActive(active);
  if (!updated || !active) {
    return updated;
  }

  const nextRunAt = computeNextRunAt(updated, new Date());
  return saveBackupScheduleConfig({
    cadence: updated.cadence,
    timezone: updated.timezone,
    timeOfDay: updated.timeOfDay,
    dayOfWeek: updated.dayOfWeek,
    dayOfMonth: updated.dayOfMonth,
    destinationPath: updated.destinationPath?.trim() || getBackupDestinationFallback(),
    nextRunAt,
    active: true,
  });
}

export async function runAutoBackupSchedulerTick(): Promise<void> {
  const dueSchedules = getDueBackupScheduleConfigs(nowIso());
  for (const schedule of dueSchedules) {
    await runSchedule(schedule);
  }
}

export function startAutoBackupScheduler(): void {
  if (schedulerTimer) return;

  void runAutoBackupSchedulerTick().catch((error) => {
    console.error('Initial auto-backup scheduler tick failed:', error);
  });

  schedulerTimer = setInterval(() => {
    void runAutoBackupSchedulerTick().catch((error) => {
      console.error('Auto-backup scheduler tick failed:', error);
    });
  }, SCHEDULER_TICK_MS);
}

export function stopAutoBackupScheduler(): void {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
}

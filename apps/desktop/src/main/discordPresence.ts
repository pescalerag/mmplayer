import { createConnection, Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout, clearTimeout } from 'node:timers';
import { DiscordActivity, DiscordStatus, validApplicationId } from '../../../../src/services/discord/activity';

export function discordFrame(op: number, payload: unknown): Buffer {
  const data = Buffer.from(JSON.stringify(payload), 'utf8'), header = Buffer.alloc(8);
  header.writeUInt32LE(op, 0);header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data]);
}
export function discordPipePaths(): string[] {
  const prefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || tmpdir();
  return Array.from({ length: 10 }, (_, index) => process.platform === 'win32'
    ? `\\\\?\\pipe\\discord-ipc-${index}` : join(prefix, `discord-ipc-${index}`));
}
/** Local IPC only: no Discord token, HTTP login, or bot impersonation. */
export class DiscordPresenceClient {
  private socket?: Socket;
  private applicationId = '';
  private latest: DiscordActivity | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private ready = false;
  private stopped = true;
  private nonce = '';
  private dirty = false;
  private lastSent = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private ackTimer?: ReturnType<typeof setTimeout>;
  status: DiscordStatus = 'disabled';
  constructor(private options: { paths?: string[]; retryMs?: number; intervalMs?: number } = {}) {}
  configure(applicationId: string): DiscordStatus {
    this.disconnect();
    if (!validApplicationId(applicationId)) return this.status = 'needs_application_id';
    this.applicationId = applicationId;this.stopped = false;
    this.status = 'waiting_for_discord';this.connect();return this.status;
  }
  setActivity(activity: DiscordActivity | null) {
    if (this.stopped) return;
    this.latest = activity;this.dirty = true;this.flush();
  }
  disconnect() {
    this.stopped = true;
    clearTimeout(this.retry);clearTimeout(this.flushTimer);clearTimeout(this.ackTimer);
    this.retry = this.flushTimer = this.ackTimer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    if (socket && !socket.destroyed) {
      if (this.ready) socket.end(discordFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: randomUUID() }));
      else socket.destroy();
    }
    this.ready = false;this.nonce = '';this.latest = null;this.dirty = false;this.lastSent = 0;this.status = 'disabled';
  }
  private connect(index = 0) {
    if (this.stopped) return;
    const paths = this.options.paths || discordPipePaths();
    if (index >= paths.length) {
      this.retry = setTimeout(() => { this.retry = undefined;this.connect(); }, this.options.retryMs ?? 15000);
      return;
    }
    const socket = createConnection(paths[index]);
    this.socket = socket;this.buffer = Buffer.alloc(0);this.ready = false;
    socket.setTimeout(2500, () => socket.destroy());
    socket.on('connect', () => socket.write(discordFrame(0, { v: 1, client_id: this.applicationId })));
    socket.on('error', () => {});
    socket.on('close', () => {
      if (this.socket !== socket || this.stopped) return;
      const wasReady = this.ready;
      this.ready = false;this.nonce = '';clearTimeout(this.ackTimer);clearTimeout(this.flushTimer);this.flushTimer = undefined;
      this.status = 'waiting_for_discord';
      if (wasReady) {
        this.retry = setTimeout(() => { this.retry = undefined;this.connect(); }, this.options.retryMs ?? 15000);
      } else this.connect(index + 1);
    });
    socket.on('data', chunk => {
      if (this.socket !== socket) return;
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 8) {
        const op = this.buffer.readUInt32LE(0), length = this.buffer.readUInt32LE(4);
        if (length > 1024 * 1024) { socket.destroy();return; }
        if (this.buffer.length < length + 8) return;
        const raw = this.buffer.subarray(8, 8 + length);this.buffer = this.buffer.subarray(8 + length);
        try {
          const data = JSON.parse(raw.toString('utf8'));
          if (op === 3) socket.write(discordFrame(4, data));
          else if (op === 2) { socket.destroy();return; }
          else if (op === 1 && data.evt === 'READY') {
            socket.setTimeout(0);this.ready = true;this.status = 'connected';this.dirty = true;this.flush();
          } else if (op === 1 && data.nonce === this.nonce) {
            this.nonce = '';clearTimeout(this.ackTimer);
            if (data.evt === 'ERROR') this.status = 'error';
            this.flush();
          }
        } catch { socket.destroy();return; }
      }
    });
  }
  private flush() {
    if (!this.ready || !this.socket || !this.dirty || this.nonce || this.stopped) return;
    const delay = this.latest ? Math.max(0, (this.options.intervalMs ?? 4500) - (Date.now() - this.lastSent)) : 0;
    if (delay) {
      if (!this.flushTimer) { this.flushTimer = setTimeout(() => { this.flushTimer = undefined;this.flush(); }, delay); }
      return;
    }
    this.nonce = randomUUID();this.dirty = false;this.lastSent = Date.now();
    this.socket.write(discordFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: this.latest }, nonce: this.nonce }));
    this.ackTimer = setTimeout(() => this.socket?.destroy(), 10000);
  }
}

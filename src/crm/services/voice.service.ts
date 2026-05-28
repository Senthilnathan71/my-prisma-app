import { Injectable } from '@nestjs/common';
import { SUPPORTED_VOICE_COMMANDS, VoiceLog } from '../models/voiceLog.model';

@Injectable()
export class VoiceService {
  private readonly logs: VoiceLog[] = [];

  createLog(payload: Omit<VoiceLog, 'id'>): VoiceLog {
    const log: VoiceLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
    this.logs.push(log);
    return log;
  }

  getCommands() {
    return SUPPORTED_VOICE_COMMANDS;
  }

  getAnalytics(query: { userId?: string; from?: string; to?: string }) {
    const from = query.from ? new Date(query.from).getTime() : Number.NEGATIVE_INFINITY;
    const to = query.to ? new Date(query.to).getTime() : Number.POSITIVE_INFINITY;
    const filtered = this.logs.filter(log => {
      const time = new Date(log.timestamp).getTime();
      const userMatches = !query.userId || String(log.userId || '') === String(query.userId);
      return userMatches && time >= from && time <= to;
    });

    const totalCommands = filtered.length;
    const successCount = filtered.filter(log => log.success).length;

    return {
      totalCommands,
      successRate: totalCommands ? Math.round((successCount / totalCommands) * 100) : 0,
      topScreens: this.topCounts(filtered, 'screen'),
      topIntents: this.topCounts(filtered, 'intent'),
    };
  }

  private topCounts(rows: VoiceLog[], key: 'screen' | 'intent') {
    const counts = new Map<string, number>();
    rows.forEach(row => counts.set(row[key], (counts.get(row[key]) || 0) + 1));
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

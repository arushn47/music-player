/**
 * Playback latency measurement instrumentation
 * Logs timing markers to console and Android logcat for benchmarking
 */

import { isTauri } from "@tauri-apps/api/core";

type LatencyStage = 
  | 'SEARCH_START'
  | 'SEARCH_COMPLETE'
  | 'VERIFY_START' 
  | 'VERIFY_COMPLETE'
  | 'PREPARE_START'
  | 'PREPARE_COMPLETE'
  | 'PLAYBACK_START';

interface TimingMarker {
  stage: LatencyStage;
  timestamp: number;
  trackId?: string;
  detail?: string;
}

class LatencyBenchmark {
  private markers: TimingMarker[] = [];
  private sessionStart: number | null = null;
  private enabled = false;

  constructor() {
    // Enable if URL contains ?benchmark or localStorage flag is set
    if (typeof window !== 'undefined') {
      this.enabled = 
        window.location.search.includes('benchmark') ||
        localStorage.getItem('lumaire:benchmark-latency') === 'true';
    }
  }

  mark(stage: LatencyStage, trackId?: string, detail?: string) {
    if (!this.enabled) return;
    
    const timestamp = performance.now();
    const marker: TimingMarker = { stage, timestamp, trackId, detail };
    this.markers.push(marker);
    
    // Log to console
    console.log(`[Latency] ${stage} ${timestamp.toFixed(1)}ms`, detail || '');
    
    // Log to Android logcat if available
    if (isTauri()) {
      try {
        // Format: I/LumaireLatency: STAGE_NAME 1234567890123
        const epochMs = Date.now();
        console.log(`LumaireLatency: ${stage} ${epochMs}`);
      } catch {
        // Ignore if not on Android
      }
    }
    
    // Track session start
    if (stage === 'SEARCH_START') {
      this.sessionStart = timestamp;
    }
    
    // Log complete playback when we reach playback start
    if (stage === 'PLAYBACK_START' && this.sessionStart !== null) {
      const totalMs = timestamp - this.sessionStart;
      console.log(`[Latency] TOTAL ${totalMs.toFixed(1)}ms`);
      this.printSummary();
    }
  }

  getMarkers(): ReadonlyArray<TimingMarker> {
    return this.markers;
  }

  getDeltas(): Record<string, number> {
    if (this.markers.length < 2) return {};
    
    const deltas: Record<string, number> = {};
    const start = this.markers.find(m => m.stage === 'SEARCH_START')?.timestamp;
    
    if (!start) return {};
    
    for (const marker of this.markers) {
      if (marker.stage !== 'SEARCH_START') {
        const key = marker.stage.toLowerCase().replace('_', '-');
        deltas[key] = marker.timestamp - start;
      }
    }
    
    return deltas;
  }

  printSummary() {
    if (!this.enabled || this.markers.length < 2) return;
    
    console.group('[Latency Summary]');
    
    let prev = this.markers[0];
    for (let i = 1; i < this.markers.length; i++) {
      const curr = this.markers[i];
      const delta = curr.timestamp - prev.timestamp;
      console.log(`${prev.stage} → ${curr.stage}: ${delta.toFixed(1)}ms`);
      prev = curr;
    }
    
    if (this.sessionStart) {
      const total = this.markers[this.markers.length - 1].timestamp - this.sessionStart;
      console.log(`\nTotal: ${total.toFixed(1)}ms`);
    }
    
    console.groupEnd();
  }

  reset() {
    this.markers = [];
    this.sessionStart = null;
  }

  enable() {
    this.enabled = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('lumaire:benchmark-latency', 'true');
    }
  }

  disable() {
    this.enabled = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lumaire:benchmark-latency');
    }
  }
}

export const latencyBenchmark = new LatencyBenchmark();

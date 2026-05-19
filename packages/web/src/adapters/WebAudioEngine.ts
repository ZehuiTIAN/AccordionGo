/**
 * adapters/WebAudioEngine.ts
 *
 * AudioEngine 的浏览器实现，使用 Web Audio API。
 *
 * 当前音色：三角波振荡器（triangle oscillator），带 ADSR 包络，
 * 近似手风琴音色，无需外部采样文件。
 *
 * 升级路径：替换为 SoundFont 采样（fetch MP3 → AudioBuffer），
 * 接口不变，只需改此文件内部实现。
 *
 * 注意：AudioContext 必须在用户手势后调用 init() 才能激活（浏览器自动播放限制）。
 */

import type { AudioEngine } from '@accordion/core';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class WebAudioEngine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private activeNodes = new Map<number, { osc: OscillatorNode; gain: GainNode }>();

  async init(): Promise<void> {
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  playNote(midi: number, duration: number, velocity = 0.7): void {
    if (!this.ctx) return;
    this.stopNote(midi);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle'; // softer tone, closer to accordion
    osc.frequency.value = midiToFreq(midi);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(velocity * 0.4, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(velocity * 0.25, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(velocity * 0.25, this.ctx.currentTime + duration / 1000 - 0.05);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + duration / 1000);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration / 1000 + 0.05);

    this.activeNodes.set(midi, { osc, gain });
    osc.onended = () => this.activeNodes.delete(midi);
  }

  stopNote(midi: number): void {
    const node = this.activeNodes.get(midi);
    if (node && this.ctx) {
      node.gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      node.osc.stop(this.ctx.currentTime + 0.05);
      this.activeNodes.delete(midi);
    }
  }

  playChord(midis: number[], duration: number): void {
    midis.forEach(midi => this.playNote(midi, duration, 0.5));
  }
}

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

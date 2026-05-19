/**
 * audio/AudioEngine.ts
 *
 * 音频引擎的平台无关接口。
 *
 * 各平台实现各自的 adapter：
 *   packages/web/src/adapters/WebAudioEngine.ts  — Web Audio API（振荡器）
 *   （待做）miniprogram/adapters/WeixinAudioEngine.ts — wx.createInnerAudioContext
 *   （待做）mobile/adapters/ExpoAudioEngine.ts       — expo-av
 *
 * LessonPlayer 通过此接口调用音频，不依赖具体实现。
 */

export interface AudioEngine {
  init(): Promise<void>;
  playNote(midi: number, duration: number, velocity?: number): void;
  stopNote(midi: number): void;
  playChord(midis: number[], duration: number): void;
}

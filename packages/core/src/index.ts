/**
 * index.ts — @accordion/core 的公共入口
 *
 * 统一导出所有平台无关的类型、配置和引擎。
 * 各平台包（web / miniprogram / mobile）通过此入口引用 core，
 * 不直接引用 core 内部路径。
 *
 * 配置：
 *   pianoAccordionConfig        — 8贝司演示版（25键，2列贝司）
 *   pianoAccordion120BassConfig — 41键 120贝司标准版（120键 Stradella）
 */

export * from './accordion/types';
export * from './accordion/theory/circle-of-fifths';
export * from './accordion/configs/piano-accordion';
export * from './accordion/configs/piano-accordion-120bass';
export * from './accordion/configs/index';
export * from './lesson/types';
export * from './lesson/LessonEngine';
export * from './audio/AudioEngine';
export * from './progress/types';

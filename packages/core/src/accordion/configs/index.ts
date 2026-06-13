/**
 * accordion/configs/index.ts
 *
 * 所有内置琴型（AccordionConfig）的注册表。
 *
 * 新增琴型时：新建 configs/<model>.ts 导出一个 AccordionConfig，并追加到这里。
 * 解析器用 KNOWN_CONFIGS 计算每首曲子的 supportedConfigs；UI 琴型下拉、
 * 左手贝斯按钮回填都从这里取，避免散落硬编码。
 *
 * 导出：KNOWN_CONFIGS, getConfig
 */

import type { AccordionConfig } from '../types';
import { pianoAccordionConfig } from './piano-accordion';
import { pianoAccordion120BassConfig } from './piano-accordion-120bass';

/** 全部内置琴型，顺序即 UI 下拉默认顺序。 */
export const KNOWN_CONFIGS: AccordionConfig[] = [
  pianoAccordionConfig,
  pianoAccordion120BassConfig,
];

/** 按 config.id 查找琴型。 */
export function getConfig(id: string): AccordionConfig | undefined {
  return KNOWN_CONFIGS.find(c => c.id === id);
}

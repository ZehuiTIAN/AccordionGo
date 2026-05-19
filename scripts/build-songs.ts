/**
 * scripts/build-songs.ts
 *
 * 构建脚本：扫描 content/songs/ 目录下的所有 MusicXML 文件，
 * 解析后输出到 packages/web/public/songs/。
 *
 * 输出结构：
 *   public/songs/manifest.json   —— 曲目列表（id、标题、时长等元数据）
 *   public/songs/{slug}.json     —— 单首曲目的完整 Course 数据
 *
 * 前端通过 fetch('/songs/manifest.json') 获取列表，
 * 点击播放时再 fetch('/songs/{slug}.json') 按需加载。
 * 后续接入后端时，只需把这两个 URL 换成 API 地址即可。
 *
 * 用法：pnpm songs
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';
import { parseMusicXML, slugify } from '../packages/web/src/score/MusicXMLParser.js';
import type { SongMeta } from '../packages/web/src/api/client.js';

const ROOT      = fileURLToPath(new URL('..', import.meta.url));
const SONGS_DIR = join(ROOT, 'content/songs');
const OUT_DIR   = join(ROOT, 'packages/web/public/songs');

async function processFile(file: string): Promise<SongMeta | null> {
  const xmlPath = join(SONGS_DIR, file);
  try {
    const xmlStr = await readFile(xmlPath, 'utf-8');
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(xmlStr, 'application/xml') as unknown as Document;

    const { course, warnings, stats } = parseMusicXML(doc);

    // Stable slug from filename (not title, to avoid ID drift on rename)
    const slug = slugify(basename(file, extname(file)));
    course.id = slug;
    course.levels.forEach((l, i) => { l.id = `${slug}-${i === 0 ? 'demo' : 'guided'}`; });

    await writeFile(join(OUT_DIR, `${slug}.json`), JSON.stringify(course));

    const warn = warnings.length ? `  ⚠ ${warnings.join(' | ')}` : '';
    console.log(`✓  ${file} → "${course.title}"  (${stats.totalNotes - stats.outOfRange} 音符, ${Math.round(stats.durationSec)}s)${warn}`);

    return {
      id: slug,
      title: course.title,
      difficulty: course.difficulty as SongMeta['difficulty'],
      file: `${slug}.json`,
      durationSec: Math.round(stats.durationSec),
      totalNotes: stats.totalNotes - stats.outOfRange,
    };
  } catch (err) {
    console.error(`✗  ${file}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(SONGS_DIR))
    .filter((f: string) => /\.(xml|musicxml)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log('ℹ  content/songs/ 目录为空，跳过构建。');
    await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify([], null, 2));
    return;
  }

  const results = await Promise.all(files.map(processFile));
  const manifest = results.filter((m: SongMeta | null): m is SongMeta => m !== null);

  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n曲目清单已写入 public/songs/manifest.json（共 ${manifest.length} 首）`);
}

main().catch(err => { console.error(err); process.exit(1); });

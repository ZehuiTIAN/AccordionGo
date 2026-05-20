# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Commit message rule — enforced by git hook

> **The commit title line MUST be 100% English. No Chinese characters allowed, ever.**
> A git hook will reject the commit automatically if the title contains Chinese.
> Body text may be in Chinese. Only the first line (title) is restricted.

## Commands

```bash
# Install all dependencies (run from repo root)
pnpm install

# Parse content/songs/ XMLs → generate public/songs/*.json + manifest
pnpm songs

# Start web dev server (runs pnpm songs first, then hot reload at localhost:5173)
pnpm dev

# Type-check without building
pnpm --filter @accordion/web exec tsc --noEmit

# Build everything
pnpm build
```

There are no tests yet. There is no lint config yet.

## File header comments

**Every source file must have a header comment block.** Keep it updated when the file changes. Format:

```ts
/**
 * path/to/file.ts
 *
 * One-line summary of what this file does.
 *
 * Longer explanation of structure, key decisions, or non-obvious constraints.
 * List exported symbols if the file is an entry point.
 */
```

When you create or modify a file, update (or add) its header comment to reflect the current state.

## Adding songs

Drop a `.xml` or `.musicxml` file into `content/songs/`, then run `pnpm songs`. The script parses it and writes JSON to `packages/web/public/songs/`. The web app fetches that JSON via `useSongs` hook → `api/client.ts`.

To switch to a backend API later: change `BASE_URL` in `packages/web/src/api/client.ts`. Nothing else needs to change.

## Architecture

This is a **pnpm monorepo** with a strict separation between platform-agnostic logic and platform-specific rendering/audio.

### The core rule: `@accordion/core` has zero UI or platform dependencies

`packages/core/src/` contains all business logic as plain TypeScript classes and interfaces. Nothing in core imports React, DOM APIs, WeChat APIs, or any audio library. This makes it reusable across Web, WeChat mini-program, and React Native without modification.

### Platform adapter pattern

Each platform package (`packages/web/`, future `packages/miniprogram/`) provides concrete implementations of the abstract interfaces defined in core:

- `AudioEngine` interface → `WebAudioEngine` (Web Audio API oscillators) for web; future `WeixinAudioEngine` (wx.createInnerAudioContext) for mini-program
- `ProgressStore` interface → LocalStorage for web; wx.setStorageSync for mini-program

When adding a new platform, **only the `adapters/` folder needs to be written from scratch**. Components and content can be ported with minimal changes.

### LessonEngine state machine

`LessonEngine` in core drives all lesson playback. It is a pure state machine with no side effects — it fires callbacks (`onPlayNote`, `onStateChange`) that the platform layer wires up to audio and UI. The state flow:

```
idle → ready → playing → [demo: auto-advance] → finished
                       → [guided: waiting_input] → correct/wrong → playing
```

`LessonPlayer` (web component) owns one `LessonEngine` instance per lesson and wires the callbacks to `WebAudioEngine` and React state.

### Accordion config and key IDs

`AccordionConfig` in core defines the full instrument layout. Key IDs (e.g. `"C4"`, `"G#3"`, `"C-major"`) are the universal identifiers used across:
- `LessonEvent.notes.keys[]` — what the lesson expects
- `AccordionView` canvas hit-testing — what the user pressed
- `LessonEngine.pressKey(keyId)` — guided mode validation

If you add a new accordion model, create a new config file in `packages/core/src/accordion/configs/` — the engine and renderer require no changes.

### MusicXML pipeline

`packages/web/src/score/MusicXMLParser.ts` accepts either an XML string (browser) or a pre-parsed `Document` object (Node.js build script using `@xmldom/xmldom`). `scripts/build-songs.ts` uses the Node.js path. The browser `XMLImport` component uses the string path.

### Canvas rendering

`AccordionView` renders entirely on a single `<canvas>` (760×320). Layout is divided into three hard-coded sections: bass panel (left), bellows (center), treble keyboard (right). All pixel constants are at the top of the file. Hit-testing in `handlePointer` mirrors the draw geometry — if you change a draw constant, update the corresponding hit-test geometry.

## Commit messages

**Title must be fully in English** (`feat:` / `fix:` / `refactor:` / `style:` prefix). Body in Chinese. Both concise. Never put Chinese in the title line.

```
style: add piano-key UI theme

- 首页卡片改为象牙色钢琴白键风格，按钮区分黑键/白键
- 英雄区加入迷你琴键装饰、飘动音符和五线谱背景
- 引入 Cormorant Garamond（标题）和 Inter（正文）字体
```

### Future: WeChat mini-program

The plan is to add `packages/miniprogram/` as a Taro 3 package that imports `@accordion/core` directly and provides WeChat-specific adapters. The web package remains for development and H5 deployment. Do **not** consolidate them — they are intentionally separate build targets.

# 歌曲内容目录

把 MusicXML 文件（`.xml` 或 `.musicxml`）放到这里，然后运行：

```bash
pnpm songs
```

脚本会自动解析所有文件，把结果写入 `packages/web/public/songs/`，前端会自动加载。

## 来源推荐

- **MuseScore**：File → Export → MusicXML
- **musescore.com**：搜索曲目 → 下载 MusicXML
- **IMSLP**：部分曲目有 MusicXML 格式

## 注意事项

- 脚本只取第一个声部（或包含"右手/treble"字样的声部）
- 音域超出 C3–C5 的音符会自动移调适配键盘
- 文件名会作为曲目 ID 的一部分，建议用英文命名

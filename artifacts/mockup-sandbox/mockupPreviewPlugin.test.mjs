import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin.ts";

test("native discovery preserves nested TSX previews and excludes private/hidden files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-discovery-"));
  try {
    const files = [
      "Card.tsx",
      "nested/Detail.tsx",
      "_Private.tsx",
      "_internal/Hidden.tsx",
      "nested/_Private.tsx",
      ".hidden/Hidden.tsx",
      ".Hidden.tsx",
      "notes.ts",
    ];
    for (const file of files) {
      const absolute = path.join(root, "src/components/mockups", file);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, "export default function Preview() { return null; }");
    }

    const plugin = mockupPreviewPlugin();
    plugin.configResolved({ root });
    await plugin.buildStart();
    const outputPath = path.join(root, "src/.generated/mockup-components.ts");
    const source = await readFile(outputPath, "utf8");
    assert.match(source, /"\.\/components\/mockups\/Card\.tsx"/);
    assert.match(source, /import\("\.\.\/components\/mockups\/Card\.tsx"\)/);
    assert.match(source, /"\.\/components\/mockups\/nested\/Detail\.tsx"/);
    assert.equal((source.match(/: \(\) => import/g) ?? []).length, 2);
    assert.doesNotMatch(source, /Private|Hidden|notes/);

    await rm(path.join(root, "src/components/mockups/Card.tsx"));
    await plugin.buildStart();
    const refreshed = await readFile(outputPath, "utf8");
    assert.doesNotMatch(refreshed, /Card/);
    assert.match(refreshed, /Detail/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discovery generates an empty module when the mockups directory is absent", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-empty-"));
  try {
    const plugin = mockupPreviewPlugin();
    plugin.configResolved({ root });
    await plugin.buildStart();
    const source = await readFile(
      path.join(root, "src/.generated/mockup-components.ts"),
      "utf8",
    );
    assert.match(source, /export const modules: ModuleMap = \{\n\n\};/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

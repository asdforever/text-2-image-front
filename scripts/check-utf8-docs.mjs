import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["openspec"];
const decoder = new TextDecoder("utf-8", { fatal: true });
const suspiciousMarkers = [
  "\uFFFD",
  "椤圭洰",
  "楠岃瘉",
  "鍜",
  "娣诲姞",
  "瀹炵幇",
  "鐢熸垚",
];

async function collectMarkdownFiles(target) {
  let info;
  try {
    info = await stat(target);
  } catch {
    // 目录不存在就跳过，不要抛。
    // 前后端分仓后，某个仓库里可能根本没有 openspec/ 这类文档目录，
    // 如果这里抛 ENOENT，prebuild 会失败，整个 Docker 构建跟着挂掉。
    return [];
  }
  if (info.isFile()) return target.endsWith(".md") ? [target] : [];
  const entries = await readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await collectMarkdownFiles(child));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(child);
  }
  return files;
}

const files = (await Promise.all(roots.map(collectMarkdownFiles))).flat().sort();
const issues = [];

for (const file of files) {
  const contents = await readFile(file);
  let text;
  try {
    text = decoder.decode(contents);
  } catch {
    issues.push(`${file}: invalid UTF-8 byte sequence`);
    continue;
  }
  const marker = suspiciousMarkers.find((candidate) => text.includes(candidate));
  if (marker) issues.push(`${file}: suspicious encoding marker ${JSON.stringify(marker)}`);
}

if (issues.length > 0) {
  console.error("UTF-8 文档检查失败：");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`UTF-8 文档检查通过：${files.length} 个 Markdown 文件`);

const missing = roots.filter((root) => !existsSync(root));
if (missing.length > 0) {
  console.log(`提示：以下目录不存在，已跳过（分仓后属正常）：${missing.join("、")}`);
}

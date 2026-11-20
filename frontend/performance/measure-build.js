import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import process from "node:process";

const frontendRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(frontendRoot, "dist");
const files = await listFiles(distRoot);
const assets = [];

for (const path of files) {
  const contents = await readFile(path);
  assets.push({
    path: relative(distRoot, path).replaceAll("\\", "/"),
    bytes: (await stat(path)).size,
    gzip_bytes: gzipSync(contents).byteLength,
  });
}

assets.sort((left, right) => left.path.localeCompare(right.path));
process.stdout.write(`${JSON.stringify({ assets }, null, 2)}\n`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return paths.flat();
}

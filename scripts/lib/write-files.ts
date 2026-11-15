/** Writing generated files to disk, shared by the sync scripts. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type GeneratedFile, REPO_ROOT } from "./paths";

export function writeGenerated(files: GeneratedFile[]): void {
  for (const file of files) {
    const absolute = join(REPO_ROOT, file.path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, file.content);
  }
}

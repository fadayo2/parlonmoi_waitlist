import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const excluded = new Set(['node_modules','.vercel','dist','.git','.sites-runtime','.artifacts','.env','supabase/.env','supabase/.temp','supabase/.branches','docs/COMPLETE_SOURCE.md']);
async function files(directory = '') {
  const output=[];
  for (const item of await readdir(directory || '.', {withFileTypes:true})) {
    const path=join(directory,item.name).replaceAll('\\','/');
    if (excluded.has(path) || /\.(?:zip|tar\.gz)$/.test(path) || (item.name.startsWith('.env') && item.name !== '.env.example')) continue;
    if (/\.(?:woff2|woff|ttf)$/.test(path)) continue;
    if (item.isDirectory()) output.push(...await files(path));
    else if (item.isFile()) output.push(path);
  }
  return output.sort();
}
const paths=await files();
if (!paths.includes('docs/FILES.md')) paths.push('docs/FILES.md');
paths.sort();
await writeFile('docs/FILES.md', '# Exact project paths\n\nAll paths below are relative to the project root. Each is included in full in the\nsource archive. `docs/COMPLETE_SOURCE.md` is a generated readable copy of every\ntext source file. The source stays split into maintainable files.\n\n```text\n' + paths.join('\n') + '\n```\n\nGenerated outputs: `dist/index.html`, `dist/privacy.html`, `dist/contact.html`,\n`dist/assets/main.js`, `dist/assets/styles.css`, the Oswald files under\n`dist/assets/fonts/`, `dist/robots.txt` and `dist/_headers`. Run `npm run build`\nto reproduce them. Only the dist folder is published.\n');
let document='# ParlonsMoi — complete source files\n\nThis document contains the complete text of every authored/configuration source\nfile and the dependency lockfile, with exact paths. Binary dependencies and compiled\ndist outputs are supplied by the build/archive; they are not hand-editable source.\nSecrets, dependencies and source-control internals are deliberately excluded.\n\n';
const languages={'.html':'html','.css':'css','.js':'javascript','.mjs':'javascript','.ts':'typescript','.json':'json','.sql':'sql','.md':'markdown','.toml':'toml'};
for (const path of paths) {
  const content=await readFile(path,'utf8');
  let fence='````'; while(content.includes(fence)) fence+='`';
  document+=`## ${path}\n\n${fence}${languages[extname(path)] || 'text'}\n${content.trimEnd()}\n${fence}\n\n`;
}
await writeFile('docs/COMPLETE_SOURCE.md',document);
console.log(`Exported ${paths.length} complete text files to docs/COMPLETE_SOURCE.md`);

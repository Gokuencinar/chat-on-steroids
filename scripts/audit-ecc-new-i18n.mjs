/** Audit newly authored ECC/dictation static UI copy against the catalog. */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const zh = JSON.parse(readFileSync('src/renderer/locales/zh-CN.json', 'utf8'));
const html = readFileSync('src/renderer/index.html', 'utf8');
const dom = new JSDOM(html);
const { document } = dom.window;
const missing = new Set();
const walker = document.createTreeWalker(document.body, 4);
while (walker.nextNode()) {
  const node = walker.currentNode;
  if (node.parentElement?.closest('script, style, svg, code, kbd, textarea, [translate="no"]')) continue;
  const value = node.textContent.replace(/\s+/g, ' ').trim();
  if (/[a-zA-Z]{2}/.test(value) && !zh[value]) missing.add(value);
}
for (const node of document.querySelectorAll('[title], [placeholder], [aria-label]')) {
  if (node.closest('[translate="no"]')) continue;
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    const value = node.getAttribute(attr);
    if (value && /[a-zA-Z]{2}/.test(value) && !zh[value]) missing.add(value);
  }
}
process.stdout.write(JSON.stringify([...missing], null, 2) + '\n');

/**
 * ECC has its own library destination. This tests the real HTML and the
 * renderer's own showTab/route source in a small DOM, without booting Electron
 * or involving plugins, projects, networking or native ECC actions.
 */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { transformSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync('src/renderer/index.html', 'utf8');
const main = readFileSync('src/renderer/main.ts', 'utf8');
const locales = ['de', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'pt-PT', 'ru', 'tr', 'vi', 'zh-CN', 'zh-TW'];
// Exact new ECC panel labels. The old ECC translations are tested separately;
// this prevents the redesigned page silently falling back to English.
const redesignedEccCopy = [
  'ECC Workspace',
  'Project learning, decisions and security checks in one place. You decide what ECC remembers and applies.',
  'Select a project to manage its learning and notes.',
  'Add project folder',
  'No local projects yet',
  'Add a project folder to start learning. Your existing files will not be changed.',
  'Continuous learning',
  'Security',
  'ECC Skills',
  'Learn from tool outcomes in this project, without collecting private chat content.',
  'Off by default. Only reviewed and approved instincts can influence project instructions.',
  'Review observed practices before allowing ECC to use them.',
  'Teach an explicit working preference without sharing your conversation history.',
  'Export / import instincts',
  'Review JSON bundles before importing. Imported instincts need separate approval.',
  'Search and read saved notes from the selected local project.',
  'Notes stay local and are not automatically injected into chats.',
  'Review selected project configuration files without executing commands or scripts.',
  'ECC engineering workflows',
  'Optional CoS-native commands for investigation, testing and handoff.',
  'Five reviewed Skills available for optional installation. No Claude-only hooks or external installers.',
  'ECC sections',
  'Search ECC Skills'
] as const;

function page(): JSDOM {
  return new JSDOM(html, { url: 'https://cos.test/' });
}

describe('standalone ECC library navigation', () => {
  it('has one ECC destination, distinct from Skills and every other library page', () => {
    const dom = page();
    try {
      const { document } = dom.window;
      const expected = ['plugins', 'skills', 'ecc', 'pets'];
      for (const key of expected) {
        expect(document.querySelectorAll(`#sidebarPrimary [data-sidebar-page="${key}"]`), key).toHaveLength(1);
        expect(document.querySelectorAll(`.panel[data-panel="${key}"]`), key).toHaveLength(1);
      }
      const links = [...document.querySelectorAll<HTMLElement>('#sidebarPrimary [data-sidebar-page]')];
      expect(new Set(links.map(link => link.dataset.sidebarPage)).size).toBe(links.length);
      const panelKeys = [...document.querySelectorAll<HTMLElement>('.panel[data-panel]')]
        .map(panel => panel.dataset.panel);
      expect(new Set(panelKeys).size).toBe(panelKeys.length);

      const trigger = document.getElementById('sidebarECC') as HTMLButtonElement | null;
      expect(trigger?.tagName).toBe('BUTTON');
      expect(trigger?.type).toBe('button');
      expect(trigger?.dataset.sidebarPage).toBe('ecc');
      expect((trigger?.getAttribute('aria-label') ?? trigger?.textContent ?? '').trim()).toMatch(/ECC/i);
      const eccPanel = document.querySelector<HTMLElement>('.panel[data-panel="ecc"]')!;
      expect(eccPanel.closest('.panel[data-panel="skills"]')).toBeNull();
      expect(eccPanel.querySelector('h1')?.textContent?.trim()).toMatch(/ECC/i);
      const skills = document.querySelector<HTMLElement>('.panel[data-panel="skills"]')!;
      expect(skills.querySelector('#skillsInstalled')).not.toBeNull();
      expect(skills.querySelector('#skillsRecommendedSection')).not.toBeNull();
    } finally {
      dom.window.close();
    }
  });

  it('moves one instance of each ECC control out of the Skills page', () => {
    const dom = page();
    try {
      const { document } = dom.window;
      const ecc = document.querySelector<HTMLElement>('.panel[data-panel="ecc"]')!;
      const skills = document.querySelector<HTMLElement>('.panel[data-panel="skills"]')!;
      const controls = [
        'eccSkillsSection', 'eccCatalog', 'eccCatalogMore', 'eccWorkspaceSection',
        'eccProject', 'eccMemoryFind', 'eccMemorySave', 'eccSecurityRun',
        'eccLearningEnabled', 'eccLearningRefresh', 'eccLearningExport', 'eccLearningImport'
      ];
      const allIds = [...document.querySelectorAll<HTMLElement>('[id]')];
      for (const id of controls) {
        const matches = allIds.filter(element => element.id === id);
        expect(matches, `one #${id} only`).toHaveLength(1);
        expect(ecc.contains(matches[0]!), `#${id} must belong to ECC`).toBe(true);
        expect(skills.contains(matches[0]!)).toBe(false);
      }
    } finally {
      dom.window.close();
    }
  });

  it('routes the actual sidebar ECC click into the one ECC panel and back to Skills', () => {
    // Isolate the production showTab function and sidebar listener by their
    // declarations. This exercises actual renderer navigation logic without
    // importing main.ts, which boots every Electron-backed feature at module load.
    const functionSource = main.match(/^function showTab\(name: string\): void \{[\s\S]*?^\}/m)?.[0];
    expect(functionSource, 'showTab() must be present').toBeTruthy();
    const listenerSource = main.match(/^\s*\$\(['"]sidebarECC['"]\)\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*showTab\(['"]ecc['"]\)\);/m)?.[0];
    expect(listenerSource, 'sidebarECC must route to showTab("ecc")').toBeTruthy();
    expect(functionSource).toMatch(/const library\s*=\s*[^;]*['"]ecc['"]/);

    const compiled = transformSync(`${functionSource}\n${listenerSource}`, {
      loader: 'ts', target: 'es2022', format: 'esm'
    }).code;
    const dom = page();
    try {
      const { document } = dom.window;
      const openSkills = vi.fn();
      const movePermissions = vi.fn();
      const visible = vi.fn();
      const reset = vi.fn();
      const factory = new Function(
        'document', '$', 'api', 'settingsSearch', 'openSkillsLibrary',
        'placePermissions', 'refreshUsage', 'openChatView', 'chatVisible', 'stickToNewest', 'FEEDS',
        `${compiled}\nreturn showTab;`
      );
      const byId = (id: string): HTMLElement => document.getElementById(id)!;
      const showTab = factory(document, byId, { refreshUpdate: vi.fn() },
        { reset }, openSkills, movePermissions, vi.fn(), vi.fn(), visible, vi.fn(), []);

      byId('sidebarECC').click();
      const ecc = document.querySelector<HTMLElement>('[data-panel="ecc"]')!;
      const skills = document.querySelector<HTMLElement>('[data-panel="skills"]')!;
      expect(document.querySelector<HTMLElement>('.app')?.dataset.screen).toBe('library');
      expect(ecc.classList.contains('is-active')).toBe(true);
      expect(skills.classList.contains('is-active')).toBe(false);
      expect(byId('sidebarECC').classList.contains('is-sel')).toBe(true);
      expect(byId('sidebarSkills').classList.contains('is-sel')).toBe(false);
      expect(byId('sidebarPrimary').hidden).toBe(false);
      expect(reset).toHaveBeenCalledTimes(1);
      expect(visible).toHaveBeenLastCalledWith(false);

      showTab('skills');
      expect(ecc.classList.contains('is-active')).toBe(false);
      expect(skills.classList.contains('is-active')).toBe(true);
      expect(byId('sidebarECC').classList.contains('is-sel')).toBe(false);
      expect(byId('sidebarSkills').classList.contains('is-sel')).toBe(true);
      expect(openSkills).toHaveBeenCalledTimes(2);
      expect(document.querySelectorAll('.panel.is-active')).toHaveLength(1);
    } finally {
      dom.window.close();
    }
  });

  it('switches independent ECC inner tab panels by click and keyboard, with one selection', () => {
    const dom = page();
    try {
      const { document } = dom.window;
      const names = ['learning', 'memory', 'security', 'skills'];
      const tablist = document.getElementById('eccViewTabs')!;
      expect(tablist.getAttribute('role')).toBe('tablist');
      for (const name of names) {
        const tabs = document.querySelectorAll<HTMLButtonElement>(`#eccViewTabs [data-ecc-view="${name}"]`);
        const panes = document.querySelectorAll<HTMLElement>(`[data-ecc-view-panel="${name}"]`);
        expect(tabs, name).toHaveLength(1);
        expect(panes, name).toHaveLength(1);
        expect(tabs[0]!.getAttribute('role')).toBe('tab');
        expect(panes[0]!.getAttribute('role')).toBe('tabpanel');
        expect(tabs[0]!.getAttribute('aria-controls')).toBe(panes[0]!.id);
      }
      const functionSource = main.match(/^function activateEccView\(name: string, focus = false\): void \{[\s\S]*?^\}/m)?.[0];
      const clickSource = main.match(/^\$\('eccViewTabs'\)\.addEventListener\('click',[\s\S]*?^\}\);/m)?.[0];
      const keydownSource = main.match(/^\$\('eccViewTabs'\)\.addEventListener\('keydown',[\s\S]*?^\}\);/m)?.[0];
      expect(functionSource, 'ECC view selection handler').toBeTruthy();
      expect(clickSource, 'ECC tab click handler').toBeTruthy();
      expect(keydownSource, 'ECC tab keyboard handler').toBeTruthy();
      const code = transformSync(`${functionSource}\n${clickSource}\n${keydownSource}`, {
        loader: 'ts', target: 'es2022', format: 'esm'
      }).code;
      new Function('document', '$', code)(document, (id: string) => document.getElementById(id)!);
      const selected = () => [...document.querySelectorAll<HTMLButtonElement>('#eccViewTabs [aria-selected="true"]')];
      const visible = () => [...document.querySelectorAll<HTMLElement>('[data-ecc-view-panel]:not([hidden])')];
      expect(selected()).toHaveLength(1);
      expect(visible()).toHaveLength(1);
      const security = document.querySelector<HTMLButtonElement>('[data-ecc-view="security"]')!;
      security.click();
      expect(selected().map(tab => tab.dataset.eccView)).toEqual(['security']);
      expect(visible().map(pane => pane.dataset.eccViewPanel)).toEqual(['security']);
      const right = new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      security.dispatchEvent(right);
      expect(right.defaultPrevented).toBe(true);
      expect(selected().map(tab => tab.dataset.eccView)).toEqual(['skills']);
      expect(visible().map(pane => pane.dataset.eccViewPanel)).toEqual(['skills']);
      tablist.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      expect(selected().map(tab => tab.dataset.eccView)).toEqual(['learning']);
      expect(visible().map(pane => pane.dataset.eccViewPanel)).toEqual(['learning']);
      tablist.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      expect(selected().map(tab => tab.dataset.eccView)).toEqual(['skills']);
      const left = new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      tablist.dispatchEvent(left);
      expect(selected().map(tab => tab.dataset.eccView)).toEqual(['security']);
      expect(visible().map(pane => pane.dataset.eccViewPanel)).toEqual(['security']);
      expect([...document.querySelectorAll<HTMLElement>('#eccViewTabs [role="tab"]')].filter(tab => tab.tabIndex === 0))
        .toHaveLength(1);
    } finally {
      dom.window.close();
    }
  });

  it('retains ECC copy in all locale catalogs without mistranslating the product name', () => {
    const keys = [
      'ECC 2.2.3 — CoS-compatible Skills',
      'ECC — Project knowledge and security',
      'ECC — Continuous learning',
      'Approve for this project',
      'Revoke approval',
      'Choose Windows offline recognition or optional OpenAI API transcription. OpenAI uploads recorded audio after you stop.'
    ];
    for (const locale of locales) {
      const catalog = JSON.parse(readFileSync(`src/renderer/locales/${locale}.json`, 'utf8')) as Record<string, string>;
      for (const key of keys) {
        expect(catalog[key]?.trim(), `${locale}: ${key}`).toBeTruthy();
        expect(catalog[key], `${locale}: untranslated ${key}`).not.toBe(key);
      }
    }
  });

  it('localizes every new ECC navigation and privacy label across all supported locale catalogs', () => {
    expect(redesignedEccCopy).toHaveLength(23);
    for (const locale of locales) {
      const catalog = JSON.parse(readFileSync(`src/renderer/locales/${locale}.json`, 'utf8')) as Record<string, string>;
      expect(catalog.ECC, `${locale}: preserve ECC product name`).toBe('ECC');
      expect(catalog['EVERYTHING CLAUDE CODE'], `${locale}: preserve upstream brand`).toBe('EVERYTHING CLAUDE CODE');
      for (const key of redesignedEccCopy) {
        expect(catalog[key]?.trim(), `${locale}: missing ${key}`).toBeTruthy();
        expect(catalog[key], `${locale}: English fallback ${key}`).not.toBe(key);
      }
    }
  });
});

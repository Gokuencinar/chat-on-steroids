import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';
import type { ManagedSkill } from '../src/shared/skills.js';

let dom: JSDOM | null = null;
afterEach(() => { dom?.window.close(); dom = null; vi.unstubAllGlobals(); vi.resetModules(); });

it('shows the managed library, imports both source shapes, filters and removes only after confirmation', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <input id="skillsSearch"><button id="skillsRefresh"></button>
    <details class="plugin-menu"><summary>Import</summary><div class="plugin-menu-actions"><button id="skillsImportFolder"></button><button id="skillsImportFile"></button><button id="skillsImportGithub"></button></div></details>
    <dialog id="skillGithubDialog"><h2 id="skillGithubTitle"></h2><p id="skillGithubDescription"></p><button id="skillGithubClose"></button><form id="skillGithubForm"><input id="skillGithubUrl"><p id="skillGithubError" hidden></p><button id="skillGithubCancel"></button><button id="skillGithubSubmit"></button></form></dialog>
    <span id="skillsCount"></span><div id="skillsInstalled"></div>
  </body>`, { url: 'https://skills.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement, HTMLButtonElement: w.HTMLButtonElement, HTMLDialogElement: w.HTMLDialogElement })) vi.stubGlobal(key, value);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  let skills: ManagedSkill[] = [];
  const listManagedSkills = vi.fn(async () => ({ ok: true as const, data: skills }));
  const skillsImport = vi.fn(async (kind: 'folder' | 'file') => {
    skills = [...skills, { id: kind, name: kind === 'folder' ? 'Folder Skill' : 'File Skill', description: 'A reusable method.', path: `/skills/${kind}/SKILL.md`, origin: null }];
    return { ok: true as const, data: skills };
  });
  const skillsRemove = vi.fn(async (id: string) => {
    skills = skills.filter(skill => skill.id !== id);
    return { ok: true as const, data: skills };
  });
  const githubOrigin = { kind: 'github' as const, url: 'https://github.com/acme/skills/tree/main/review', ref: 'main', directory: 'review', commit: 'a'.repeat(40), revision: 'b'.repeat(64), skillSha256: 'c'.repeat(64) };
  const skillsImportGithub = vi.fn(async (_url: string) => {
    skills = [...skills, { id: 'review', name: 'Code Review', description: 'From GitHub.', path: '/skills/review/SKILL.md', origin: githubOrigin }];
    return { ok: true as const, data: skills };
  });
  const skillsUpdateGithub = vi.fn(async (_id: string) => {
    skills = skills.map(skill => skill.id === 'review' ? { ...skill, description: 'Updated from GitHub.' } : skill);
    return { ok: true as const, data: { status: 'updated' as const, skills } };
  });
  const skillsCheckGithub = vi.fn(async (_id: string) => ({ ok: true as const, data: [
    { id: 'review', originRevision: githubOrigin.revision, state: 'available' as const, checkedAt: Date.now() }
  ] }));
  const { initSkillsLibrary } = await import('../src/renderer/skills-library.js');
  const open = initSkillsLibrary({ listManagedSkills, skillsImport, skillsRemove, skillsImportGithub, skillsCheckGithub, skillsUpdateGithub } as any);
  await vi.waitFor(() => expect(w.document.getElementById('skillsInstalled')!.textContent).toContain('No skills installed'));
  (w.document.getElementById('skillsImportFolder') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(w.document.querySelectorAll('.skill-library-card')).toHaveLength(1));
  expect(w.document.querySelector('[data-skill-id="folder"]')!.textContent).toContain('/folder');
  expect(w.document.querySelector('[data-skill-id="folder"] .skill-library-source')!.textContent).toContain('Local');
  expect(w.document.querySelector('[data-skill-id="folder"] .plugin-menu-actions')!.textContent).toContain('Link GitHub source');
  (w.document.getElementById('skillsImportFile') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(w.document.querySelectorAll('.skill-library-card')).toHaveLength(2));
  expect(skillsImport.mock.calls.map(call => call[0])).toEqual(['folder', 'file']);
  const search = w.document.getElementById('skillsSearch') as HTMLInputElement;
  search.value = 'file'; search.dispatchEvent(new w.Event('input'));
  expect(w.document.querySelectorAll('.skill-library-card')).toHaveLength(1);
  expect(w.document.getElementById('skillsCount')!.textContent).toContain('2 skills');
  (w.document.querySelector('[data-skill-id="file"] .plugin-destructive') as HTMLButtonElement).click();
  expect(w.document.getElementById('skillRemoveDialog')).not.toBeNull();
  expect(skillsRemove).not.toHaveBeenCalled();
  (w.document.querySelector('#skillRemoveDialog .pet-delete-cancel') as HTMLButtonElement).click();
  expect(skillsRemove).not.toHaveBeenCalled();
  (w.document.querySelector('[data-skill-id="file"] .plugin-destructive') as HTMLButtonElement).click();
  (w.document.querySelector('#skillRemoveDialog .pet-delete-confirm') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(skillsRemove).toHaveBeenCalledWith('file'));
  await vi.waitFor(() => expect(w.document.getElementById('skillRemoveDialog')).toBeNull());
  expect(w.document.getElementById('skillsInstalled')!.textContent).toContain('No skills match');

  search.value = ''; search.dispatchEvent(new w.Event('input'));
  (w.document.getElementById('skillsImportGithub') as HTMLButtonElement).click();
  expect((w.document.getElementById('skillGithubDialog') as HTMLDialogElement).open).toBe(true);
  (w.document.getElementById('skillGithubUrl') as HTMLInputElement).value = githubOrigin.url;
  w.document.getElementById('skillGithubForm')!.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await vi.waitFor(() => expect(skillsImportGithub).toHaveBeenCalledWith(githubOrigin.url));
  await vi.waitFor(() => expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')).not.toBeNull());
  expect((w.document.getElementById('skillGithubDialog') as HTMLDialogElement).open).toBe(false);
  expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')!.textContent).toContain('Up to date');
  expect(w.document.querySelector<HTMLElement>('[data-skill-id="review"] .skill-library-source')!.title)
    .toContain('main @ aaaaaaaaaaaa');
  (w.document.getElementById('skillsRefresh') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(skillsCheckGithub).toHaveBeenCalledWith('review'));
  await vi.waitFor(() => expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')!.textContent).toContain('Update available'));
  expect(w.document.querySelector('[data-skill-id="review"] .skill-library-update')).not.toBeNull();
  expect(skillsUpdateGithub).not.toHaveBeenCalled();
  open();
  await vi.waitFor(() => expect(listManagedSkills).toHaveBeenCalledTimes(3));
  expect(skillsCheckGithub).toHaveBeenCalledTimes(1);
  (w.document.querySelector('[data-skill-id="review"] .plugin-menu-actions .btn') as HTMLButtonElement).click();
  expect(w.document.getElementById('skillUpdateDialog')).not.toBeNull();
  expect(w.document.querySelector('#skillUpdateDialog .skill-source-revision')?.textContent)
    .toBe('main @ aaaaaaaaaaaa');
  expect(skillsUpdateGithub).not.toHaveBeenCalled();
  (w.document.querySelector('#skillUpdateDialog .pet-delete-actions .btn') as HTMLButtonElement).click();
  expect(skillsUpdateGithub).not.toHaveBeenCalled();
  (w.document.querySelector('[data-skill-id="review"] .plugin-menu-actions .btn') as HTMLButtonElement).click();
  (w.document.querySelector('#skillUpdateDialog .pet-delete-actions .btn-solid') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(skillsUpdateGithub).toHaveBeenCalledWith('review'));
  await vi.waitFor(() => expect(w.document.querySelector('[data-skill-id="review"]')!.textContent).toContain('Updated from GitHub.'));
  expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')!.textContent).toContain('Up to date');
  skillsCheckGithub.mockResolvedValueOnce({ ok: false as const, error: 'GitHub API rate limit reached' } as any);
  await vi.waitFor(() => expect((w.document.getElementById('skillsRefresh') as HTMLButtonElement).disabled).toBe(false));
  (w.document.getElementById('skillsRefresh') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')!.textContent).toContain('Check failed'));
  expect(w.document.querySelector<HTMLElement>('[data-skill-id="review"] .skill-library-source')!.title).toContain('rate limit');
  await vi.waitFor(() => expect((w.document.getElementById('skillsRefresh') as HTMLButtonElement).disabled).toBe(false));
  (w.document.getElementById('skillsRefresh') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')!.textContent).toContain('Update available'));
});

it('links a matching local skill from its card without replacing it or hiding GitHub check errors', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <input id="skillsSearch"><button id="skillsRefresh"></button>
    <details class="plugin-menu"><summary>Import</summary><div><button id="skillsImportFolder"></button><button id="skillsImportFile"></button><button id="skillsImportGithub"></button></div></details>
    <dialog id="skillGithubDialog"><h2 id="skillGithubTitle"></h2><p id="skillGithubDescription"></p><button id="skillGithubClose"></button><form id="skillGithubForm"><input id="skillGithubUrl"><p id="skillGithubError" hidden></p><button id="skillGithubCancel"></button><button id="skillGithubSubmit"></button></form></dialog>
    <span id="skillsCount"></span><div id="skillsInstalled"></div>
  </body>`, { url: 'https://skills.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement, HTMLButtonElement: w.HTMLButtonElement, HTMLDialogElement: w.HTMLDialogElement })) vi.stubGlobal(key, value);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  const local: ManagedSkill = { id: 'review', name: 'Review', description: 'Local instructions.', path: '/skills/review/SKILL.md', origin: null };
  const origin = { kind: 'github' as const, url: 'https://github.com/acme/skills/tree/main/review', ref: 'main', directory: 'review', commit: 'a'.repeat(40), revision: 'b'.repeat(64), skillSha256: 'c'.repeat(64) };
  const listManagedSkills = vi.fn(async () => ({ ok: true as const, data: [local] }));
  const skillsLinkGithub = vi.fn().mockResolvedValueOnce({ ok: false, error: 'The local SKILL.md does not match this GitHub source' })
    .mockResolvedValueOnce({ ok: true, data: [{ ...local, origin }] });
  const skillsCheckGithub = vi.fn(async () => ({ ok: true as const, data: [
    { id: 'review', originRevision: origin.revision, state: 'available' as const, checkedAt: Date.now() }
  ] }));
  const { initSkillsLibrary } = await import('../src/renderer/skills-library.js');
  initSkillsLibrary({ listManagedSkills, skillsLinkGithub, skillsCheckGithub } as any);
  await vi.waitFor(() => expect(w.document.querySelector('.skill-library-card')).not.toBeNull());
  (w.document.querySelector('[data-skill-id="review"] .plugin-menu-actions .btn') as HTMLButtonElement).click();
  expect(w.document.getElementById('skillGithubTitle')!.textContent).toContain('Link Review');
  expect(w.document.getElementById('skillGithubDescription')!.textContent).toContain('Your files stay in place');
  (w.document.getElementById('skillGithubUrl') as HTMLInputElement).value = origin.url;
  w.document.getElementById('skillGithubForm')!.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await vi.waitFor(() => expect(w.document.getElementById('skillGithubError')!.textContent).toContain('does not match'));
  expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')!.textContent).toContain('Local');
  w.document.getElementById('skillGithubForm')!.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await vi.waitFor(() => expect(skillsLinkGithub).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(w.document.querySelector('[data-skill-id="review"] .skill-library-source')!.textContent).toContain('Update available'));
  expect(skillsCheckGithub).toHaveBeenCalledWith('review');
});

it('automatically checks an installed GitHub skill on page open without installing it', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <input id="skillsSearch"><button id="skillsRefresh"></button>
    <details class="plugin-menu"><summary>Import</summary><div><button id="skillsImportFolder"></button><button id="skillsImportFile"></button><button id="skillsImportGithub"></button></div></details>
    <dialog id="skillGithubDialog"><h2 id="skillGithubTitle"></h2><p id="skillGithubDescription"></p><button id="skillGithubClose"></button><form id="skillGithubForm"><input id="skillGithubUrl"><p id="skillGithubError" hidden></p><button id="skillGithubCancel"></button><button id="skillGithubSubmit"></button></form></dialog>
    <span id="skillsCount"></span><div id="skillsInstalled"></div>
  </body>`, { url: 'https://skills.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement, HTMLButtonElement: w.HTMLButtonElement, HTMLDialogElement: w.HTMLDialogElement })) vi.stubGlobal(key, value);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  const origin = { kind: 'github' as const, url: 'https://github.com/acme/skills/tree/main/review', ref: 'main', directory: 'review', commit: 'a'.repeat(40), revision: 'b'.repeat(64), skillSha256: 'c'.repeat(64) };
  const installed: ManagedSkill[] = [{ id: 'review', name: 'Code Review', description: 'From GitHub.', path: '/skills/review/SKILL.md', origin }];
  const listManagedSkills = vi.fn(async () => ({ ok: true as const, data: installed }));
  const skillsCheckGithub = vi.fn(async () => ({ ok: true as const, data: [
    { id: 'review', originRevision: origin.revision, state: 'available' as const, checkedAt: Date.now() }
  ] }));
  const skillsUpdateGithub = vi.fn();
  const { initSkillsLibrary } = await import('../src/renderer/skills-library.js');
  const open = initSkillsLibrary({ listManagedSkills, skillsCheckGithub, skillsUpdateGithub } as any);
  await vi.waitFor(() => expect(w.document.querySelector('.skill-library-card')).not.toBeNull());
  expect(skillsCheckGithub).not.toHaveBeenCalled();
  open();
  await vi.waitFor(() => expect(skillsCheckGithub).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(w.document.querySelector('.skill-library-source')!.textContent).toBe('Update available'));
  expect(skillsUpdateGithub).not.toHaveBeenCalled();
  (w.document.querySelector('.skill-library-update') as HTMLButtonElement).click();
  expect(w.document.getElementById('skillUpdateDialog')).not.toBeNull();
  expect(skillsUpdateGithub).not.toHaveBeenCalled();
});

it('offers recommended skills that are not installed yet and installs one on request', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <input id="skillsSearch"><button id="skillsRefresh"></button>
    <details class="plugin-menu"><summary>Import</summary><div class="plugin-menu-actions"><button id="skillsImportFolder"></button><button id="skillsImportFile"></button><button id="skillsImportGithub"></button></div></details>
    <dialog id="skillGithubDialog"><h2 id="skillGithubTitle"></h2><p id="skillGithubDescription"></p><button id="skillGithubClose"></button><form id="skillGithubForm"><input id="skillGithubUrl"><p id="skillGithubError" hidden></p><button id="skillGithubCancel"></button><button id="skillGithubSubmit"></button></form></dialog>
    <span id="skillsCount"></span><div id="skillsInstalled"></div>
    <section id="skillsRecommendedSection" hidden><span id="skillsRecommendedCount"></span><div id="skillsRecommended"></div></section>
  </body>`, { url: 'https://skills.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement, HTMLButtonElement: w.HTMLButtonElement, HTMLDialogElement: w.HTMLDialogElement })) vi.stubGlobal(key, value);
  let skills: ManagedSkill[] = [];
  const installRecommendedSkill = vi.fn(async (id: string) => {
    skills = [{ id, name: 'Code review', description: 'Review a change.', path: `/skills/${id}/SKILL.md`, origin: null }];
    return { ok: true as const, data: skills };
  });
  const api = {
    listManagedSkills: vi.fn(async () => ({ ok: true as const, data: skills })),
    listRecommendedSkills: vi.fn(async () => ({ ok: true as const, data: [
      { id: 'code-review', name: 'Code review', description: 'Review a change.', installed: false },
      { id: 'clear-writing', name: 'Clear writing', description: 'Write clearly.', installed: false }
    ] })),
    installRecommendedSkill, skillsCheckGithub: vi.fn(async () => ({ ok: true as const, data: [] }))
  };
  const { initSkillsLibrary } = await import('../src/renderer/skills-library.js');
  const open = initSkillsLibrary(api as never); open();
  await vi.waitFor(() => expect(w.document.querySelectorAll('[data-recommended-skill-id]').length).toBe(2));
  expect(w.document.getElementById('skillsRecommendedSection')!.hidden).toBe(false);
  w.document.querySelector<HTMLButtonElement>('[data-recommended-skill-id="code-review"] .skill-recommended-install')!.click();
  await vi.waitFor(() => expect(w.document.querySelectorAll('[data-recommended-skill-id]').length).toBe(1));
  expect(installRecommendedSkill).toHaveBeenCalledWith('code-review');
  expect(w.document.querySelector('[data-skill-id="code-review"]')).not.toBeNull();
});

it('shows recommended skill descriptions in the interface language and finds them by that text', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <input id="skillsSearch"><button id="skillsRefresh"></button>
    <details class="plugin-menu"><summary>Import</summary><div class="plugin-menu-actions"><button id="skillsImportFolder"></button><button id="skillsImportFile"></button><button id="skillsImportGithub"></button></div></details>
    <dialog id="skillGithubDialog"><h2 id="skillGithubTitle"></h2><p id="skillGithubDescription"></p><button id="skillGithubClose"></button><form id="skillGithubForm"><input id="skillGithubUrl"><p id="skillGithubError" hidden></p><button id="skillGithubCancel"></button><button id="skillGithubSubmit"></button></form></dialog>
    <span id="skillsCount"></span><div id="skillsInstalled"></div>
    <section id="skillsRecommendedSection" hidden><span id="skillsRecommendedCount"></span><div id="skillsRecommended"></div></section>
  </body>`, { url: 'https://skills.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement, HTMLButtonElement: w.HTMLButtonElement, HTMLDialogElement: w.HTMLDialogElement })) vi.stubGlobal(key, value);
  const { RECOMMENDED_SKILLS } = await import('../src/shared/recommended-skills.js');
  const review = RECOMMENDED_SKILLS.find(skill => skill.id === 'code-review')!;
  const writing = RECOMMENDED_SKILLS.find(skill => skill.id === 'clear-writing')!;
  const api = {
    listManagedSkills: vi.fn(async () => ({ ok: true as const, data: [] })),
    listRecommendedSkills: vi.fn(async () => ({ ok: true as const, data: [review, writing].map(({ id, name, description }) => ({ id, name, description, installed: false })) })),
    skillsCheckGithub: vi.fn(async () => ({ ok: true as const, data: [] }))
  };
  const { setLanguage } = await import('../src/renderer/i18n.js');
  setLanguage('de');
  try {
    const { initSkillsLibrary } = await import('../src/renderer/skills-library.js');
    initSkillsLibrary(api as never)();
    const card = () => w.document.querySelector('[data-recommended-skill-id="code-review"] p.muted')?.textContent;
    await vi.waitFor(() => expect(card()).toMatch(/^Prüfe eine Änderung/));
    const search = w.document.getElementById('skillsSearch') as HTMLInputElement;
    search.value = 'befunde'; search.dispatchEvent(new w.Event('input'));
    await vi.waitFor(() => expect([...w.document.querySelectorAll<HTMLElement>('[data-recommended-skill-id]')].map(item => item.dataset.recommendedSkillId)).toEqual(['code-review']));
  } finally { setLanguage('en'); }
});

it('offers both ECC install modes in one card, requires confirmation for 33 Skills, and preserves the existing 8-workflow action', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <input id="skillsSearch"><button id="skillsRefresh"></button>
    <button id="skillsImportFolder"></button><button id="skillsImportFile"></button><button id="skillsImportGithub"></button>
    <dialog id="skillGithubDialog"><h2 id="skillGithubTitle"></h2><p id="skillGithubDescription"></p><button id="skillGithubClose"></button><form id="skillGithubForm"><input id="skillGithubUrl"><p id="skillGithubError" hidden></p><button id="skillGithubCancel"></button><button id="skillGithubSubmit"></button></form></dialog>
    <span id="skillsCount"></span><div id="skillsInstalled"></div>
    <section id="skillsRecommendedSection"><span id="skillsRecommendedCount"></span><div id="skillsRecommended"></div></section>
    <section id="eccRecommendedSection" hidden><div id="eccRecommended"></div></section>
  </body>`, { url: 'https://skills.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement, HTMLButtonElement: w.HTMLButtonElement, HTMLDialogElement: w.HTMLDialogElement })) vi.stubGlobal(key, value);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  const { ECC_SKILLS, ECC_PACK, ECC_COMPLETE_PACK } = await import('../src/shared/ecc-skills.js');
  const { ECC_CATALOG } = await import('../src/shared/ecc-catalog.js');
  const fullIds = [...ECC_SKILLS, ...ECC_CATALOG].map(item => item.id);
  let skills: ManagedSkill[] = [];
  const listRecommendedSkills = vi.fn(async () => ({ ok: true as const, data: [
    { ...ECC_PACK, installed: false, members: ECC_SKILLS.map(item => item.id) },
    { ...ECC_COMPLETE_PACK, installed: false, members: fullIds }
  ] }));
  const installRecommendedSkill = vi.fn(async (id: string) => {
    const additions = id === ECC_PACK.id ? ECC_SKILLS.map(skill => skill.id) : fullIds;
    const have = new Set(skills.map(item => item.id));
    skills = [...skills, ...additions.filter(skill => !have.has(skill)).map(skill => ({
      id: skill, name: skill, description: 'ECC', path: `/skills/${skill}/SKILL.md`, origin: null
    }))];
    return { ok: true as const, data: skills };
  });
  const api = { listManagedSkills: vi.fn(async () => ({ ok: true as const, data: skills })),
    listRecommendedSkills, installRecommendedSkill, skillsCheckGithub: vi.fn(async () => ({ ok: true as const, data: [] })) };
  const { initSkillsLibrary } = await import('../src/renderer/skills-library.js');
  initSkillsLibrary(api as never)();
  await vi.waitFor(() => expect(w.document.querySelectorAll('#eccRecommended .skill-library-card')).toHaveLength(1));
  const card = w.document.querySelector('#eccRecommended .skill-library-card')!;
  expect(card.textContent).toContain('ECC All Workflows');
  const actions = [...card.querySelectorAll<HTMLButtonElement>('button')];
  expect(actions.map(item => item.textContent)).toEqual(['Install 8 workflows', 'Install complete ECC pack (33 Skills)']);
  actions[1]!.click();
  expect(installRecommendedSkill).not.toHaveBeenCalled();
  let dialog = w.document.getElementById('eccCompleteInstallDialog') as HTMLDialogElement;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain('33 new Skills');
  (dialog.querySelector('.pet-delete-actions .btn') as HTMLButtonElement).click();
  expect(installRecommendedSkill).not.toHaveBeenCalled();
  actions[0]!.click();
  await vi.waitFor(() => expect(skills).toHaveLength(8));
  expect(installRecommendedSkill).toHaveBeenCalledWith('ecc-core-pack');
  await vi.waitFor(() => expect([...w.document.querySelectorAll<HTMLButtonElement>('#eccRecommended .skill-library-card button')]
    .map(button => button.textContent)).toEqual(['Install complete ECC pack (33 Skills)']));
  const singleCard = w.document.querySelector('#eccRecommended .skill-library-card')!;
  (singleCard.querySelector('button') as HTMLButtonElement).click();
  dialog = w.document.getElementById('eccCompleteInstallDialog') as HTMLDialogElement;
  expect(dialog.textContent).toContain('25 new Skills');
  (dialog.querySelector('.pet-delete-actions .btn-solid') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(skills).toHaveLength(33));
  expect(installRecommendedSkill).toHaveBeenCalledWith('ecc-complete-pack');
  await vi.waitFor(() => expect(w.document.getElementById('eccRecommendedSection')!.hidden).toBe(true));
});

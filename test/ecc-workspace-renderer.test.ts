import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';

let dom: JSDOM | null = null;
afterEach(() => { dom?.window.close(); dom = null; vi.unstubAllGlobals(); vi.resetModules(); });

it('never calls ECC knowledge/audit actions without an explicitly selected local project', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <select id="eccProject"></select><div id="eccMemoryResults"></div><div id="eccMemoryDetail"></div>
    <div id="eccSecurityResults"></div><input id="eccMemorySearch"><input id="eccMemoryTitle">
    <textarea id="eccMemoryBody"></textarea><select id="eccMemoryKind"><option value="lesson">lesson</option></select>
    <button id="eccMemorySave"></button><button id="eccSecurityRun"></button><button id="eccMemoryFind"></button>
  </body>`, { url: 'https://cos.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement,
    HTMLButtonElement: w.HTMLButtonElement, HTMLSelectElement: w.HTMLSelectElement,
    HTMLInputElement: w.HTMLInputElement, HTMLTextAreaElement: w.HTMLTextAreaElement })) vi.stubGlobal(key, value);
  const save = vi.fn(async () => ({ ok: true as const, data: {} }));
  const audit = vi.fn(async () => ({ ok: true as const, data: { filesScanned: 1, findings: [], partial: false } }));
  const list = vi.fn(async () => ({ ok: true as const, data: [] }));
  const search = vi.fn(async () => ({ ok: true as const, data: [] }));
  const api = {
    listProjects: async () => ({ ok: true as const, data: [
      { id: 'project-1', name: 'Active', path: '/approved/one', createdAt: 1 },
      { id: 'project-2', name: 'Hidden', path: '/approved/two', createdAt: 1, ungrouped: true }
    ] }),
    eccListMemories: list, eccSearchMemories: search, eccSaveMemory: save, eccSecurityAudit: audit
  };
  const { initEccWorkspace } = await import('../src/renderer/ecc-workspace.js');
  initEccWorkspace(api as any);
  await vi.waitFor(() => expect(w.document.querySelectorAll('#eccProject option')).toHaveLength(2));
  const selected = w.document.querySelector<HTMLSelectElement>('#eccProject')!;
  expect(selected.value).toBe('');
  w.document.querySelector<HTMLInputElement>('#eccMemoryTitle')!.value = 'Reviewed lesson';
  w.document.querySelector<HTMLTextAreaElement>('#eccMemoryBody')!.value = 'Verified evidence';
  w.document.getElementById('eccMemorySave')!.click();
  w.document.getElementById('eccSecurityRun')!.click();
  expect(save).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  selected.value = 'project-1'; selected.dispatchEvent(new w.Event('change'));
  await vi.waitFor(() => expect(list).toHaveBeenCalledWith('project-1'));
  w.document.getElementById('eccMemorySave')!.click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledWith('project-1', {
    kind: 'lesson', title: 'Reviewed lesson', body: 'Verified evidence'
  }));
  w.document.getElementById('eccSecurityRun')!.click();
  await vi.waitFor(() => expect(audit).toHaveBeenCalledWith('project-1'));
  expect(save).not.toHaveBeenCalledWith('project-2', expect.anything());
});

it('explains an empty LocalProject catalog and delegates creation to the existing approved folder picker', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <button type="button" id="addProject">Add a project folder</button>
    <label for="eccProject"><select id="eccProject"><option value="">Choose a project</option></select></label>
    <div id="eccMemoryResults"></div><div id="eccMemoryDetail"></div><div id="eccSecurityResults"></div>
    <input id="eccMemorySearch"><input id="eccMemoryTitle"><textarea id="eccMemoryBody"></textarea>
    <select id="eccMemoryKind"><option value="lesson">Lesson</option></select>
    <button id="eccMemorySave"></button><button id="eccSecurityRun"></button><button id="eccMemoryFind"></button>
  </body>`, { url: 'https://cos.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement,
    HTMLButtonElement: w.HTMLButtonElement, HTMLSelectElement: w.HTMLSelectElement,
    HTMLInputElement: w.HTMLInputElement, HTMLTextAreaElement: w.HTMLTextAreaElement })) vi.stubGlobal(key, value);
  const pickerClick = vi.fn();
  w.document.getElementById('addProject')!.addEventListener('click', pickerClick);
  let projects: Array<{ id: string; name: string; path: string; createdAt: number; ungrouped?: boolean }> = [];
  const listProjects = vi.fn(async () => ({ ok: true as const, data: projects }));
  const addProject = vi.fn();
  const listMemories = vi.fn(async () => ({ ok: true as const, data: [] }));
  const api = { listProjects, addProject, eccListMemories: listMemories,
    eccSearchMemories: vi.fn(), eccSaveMemory: vi.fn(), eccSecurityAudit: vi.fn() };
  const { initEccWorkspace } = await import('../src/renderer/ecc-workspace.js');
  const refresh = initEccWorkspace(api as any);
  const selector = w.document.querySelector<HTMLSelectElement>('#eccProject')!;
  const notice = w.document.querySelector<HTMLElement>('label[for="eccProject"] + .plugin-search-actions')!;
  await vi.waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(notice.hidden).toBe(false));
  expect(notice.textContent).toContain('No projects yet.');
  expect(selector.options).toHaveLength(1);
  expect(selector.value).toBe('');

  const create = notice.querySelector<HTMLButtonElement>('button')!;
  expect(create.textContent).toContain('Add a project folder');
  create.click();
  expect(pickerClick).toHaveBeenCalledTimes(1);
  expect(addProject).not.toHaveBeenCalled(); // Existing app dialog owns approval and persistence.
  expect(listMemories).not.toHaveBeenCalled(); // No implicit project binding.

  projects = [{ id: 'existing-id', name: 'Existing', path: '/approved/existing', createdAt: 5 }];
  refresh(); // Called by the existing Skills tab when the user returns from the picker.
  await vi.waitFor(() => expect(selector.options).toHaveLength(2));
  expect(notice.hidden).toBe(true);
  expect(selector.options[1]?.textContent).toBe('Existing');
  expect(selector.value).toBe(''); // Project selection stays explicit.
  expect(addProject).not.toHaveBeenCalled();
});

it('uses the real ECC empty-state controls and updates its project hint after the existing picker adds a project', async () => {
  // Mirror the current index.html ECC project bar (not the legacy fallback).
  dom = new JSDOM(`<!doctype html><body>
    <button type="button" id="addProject">Existing sidebar project picker</button>
    <section id="eccWorkspaceSection">
      <div class="ecc-project-bar">
        <div class="ecc-project-choice">
          <label for="eccProject">Local project</label>
          <select id="eccProject"><option value="">Choose a project</option></select>
          <p id="eccProjectHint" class="muted" role="status">Select a project to manage its learning and notes.</p>
        </div>
        <button id="eccAddProject" type="button">Add project folder</button>
      </div>
      <div class="ecc-empty" id="eccNoProjects" role="status" hidden>
        <strong>No local projects yet</strong>
        <p>Add a project folder to start learning. Your existing files will not be changed.</p>
      </div>
      <div id="eccMemoryResults"></div><div id="eccMemoryDetail"></div>
      <div id="eccSecurityResults"></div><input id="eccMemorySearch">
      <input id="eccMemoryTitle"><textarea id="eccMemoryBody"></textarea>
      <select id="eccMemoryKind"><option value="lesson">Lesson</option></select>
      <button id="eccMemorySave"></button><button id="eccSecurityRun"></button>
      <button id="eccMemoryFind"></button>
    </section>
  </body>`, { url: 'https://cos.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement,
    HTMLButtonElement: w.HTMLButtonElement, HTMLSelectElement: w.HTMLSelectElement,
    HTMLInputElement: w.HTMLInputElement, HTMLTextAreaElement: w.HTMLTextAreaElement })) vi.stubGlobal(key, value);

  const sidebarPicker = vi.fn();
  w.document.getElementById('addProject')!.addEventListener('click', sidebarPicker);
  let catalog: Array<{ id: string; name: string; path: string; createdAt: number }> = [];
  const listProjects = vi.fn(async () => ({ ok: true as const, data: catalog }));
  const listMemories = vi.fn(async () => ({ ok: true as const, data: [] }));
  const api = { listProjects, eccListMemories: listMemories, eccSearchMemories: vi.fn(),
    eccSaveMemory: vi.fn(), eccSecurityAudit: vi.fn(), addProject: vi.fn() };

  const { initEccWorkspace } = await import('../src/renderer/ecc-workspace.js');
  const refresh = initEccWorkspace(api as any);
  const select = w.document.querySelector<HTMLSelectElement>('#eccProject')!;
  const empty = w.document.getElementById('eccNoProjects')!;
  const hint = w.document.getElementById('eccProjectHint')!;
  await vi.waitFor(() => expect(listProjects).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(empty.hidden).toBe(false));
  expect(hint.textContent).toBe('Add a project folder to start learning. Your existing files will not be changed.');
  expect(select.options).toHaveLength(1);
  expect(select.value).toBe('');

  w.document.getElementById('eccAddProject')!.click();
  expect(sidebarPicker).toHaveBeenCalledTimes(1);
  expect(api.addProject).not.toHaveBeenCalled(); // No second picker or bypass of folder approval.
  expect(listMemories).not.toHaveBeenCalled();

  // The already-existing picker persists this project; returning to ECC refreshes the catalog.
  catalog = [{ id: 'saved-project', name: 'Existing project', path: '/approved/existing', createdAt: 1 }];
  refresh();
  await vi.waitFor(() => expect(select.options).toHaveLength(2));
  expect(empty.hidden).toBe(true);
  expect(hint.textContent).toBe('Select a project to manage its learning and notes.');
  expect(select.options[1]?.value).toBe('saved-project');
  expect(select.options[1]?.textContent).toBe('Existing project');
  expect(select.value).toBe(''); // ECC must not choose a project without the user's action.
  expect(listMemories).not.toHaveBeenCalled();
});

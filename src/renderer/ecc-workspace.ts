import type { AppApi } from '../preload/index.js';
import type { EccMemoryKind, EccMemorySummary } from '../shared/ecc-memory.js';
import { $, el, run, toast } from './dom.js';
import { t } from './i18n.js';
import { initEccLearningUi } from './ecc-learning-ui.js';

/** Deliberate project-scoped ECC operations. The renderer never supplies raw filesystem paths. */
export function initEccWorkspace(api: AppApi): () => void {
  if (!document.getElementById('eccProject') || typeof api.eccListMemories !== 'function') return () => undefined;
  const project = $<HTMLSelectElement>('eccProject');
  // Approved filesystem roots are not LocalProjects. When the catalog is empty,
  // reuse the app's existing picker/approval flow rather than inventing one here.
  // Current ECC page provides a designed empty state. Older fixtures/embedded pages receive
  // the equivalent fallback, so both paths share the existing approved project picker.
  const emptyProjects = document.getElementById('eccNoProjects') ?? el('div', 'plugin-search-actions');
  const addProject = document.getElementById('eccAddProject') ?? el('button', 'btn', () => t('Add a project folder'));
  if (!document.getElementById('eccNoProjects')) {
    emptyProjects.append(el('p', 'muted', () => t('No projects yet.')));
    if (document.getElementById('addProject')) emptyProjects.append(addProject);
    (project.closest('label') ?? project).after(emptyProjects);
  }
  (addProject as HTMLButtonElement).type = 'button';
  addProject.addEventListener('click', () => document.getElementById('addProject')?.click());
  emptyProjects.hidden = true;
  const entries = $('eccMemoryResults');
  const detail = $('eccMemoryDetail');
  const findings = $('eccSecurityResults');
  const search = $<HTMLInputElement>('eccMemorySearch');
  const title = $<HTMLInputElement>('eccMemoryTitle');
  const body = $<HTMLTextAreaElement>('eccMemoryBody');
  const kind = $<HTMLSelectElement>('eccMemoryKind');
  const save = $<HTMLButtonElement>('eccMemorySave');
  const audit = $<HTMLButtonElement>('eccSecurityRun');
  const query = $<HTMLButtonElement>('eccMemoryFind');
  let request = 0;
  const chosen = (): string => project.value;
  const refreshLearning = initEccLearningUi(api, chosen);

  const showMemories = (memories: EccMemorySummary[], selected: string, token: number): void => {
    if (token !== request || selected !== chosen()) return;
    entries.replaceChildren(); detail.replaceChildren();
    if (!memories.length) { entries.append(el('p', 'muted', () => t('No matching memories for this project.'))); return; }
    for (const item of memories) {
      const card = el('article', 'plugin-card pet-library-card');
      const text = el('div', 'plugin-card-title');
      text.append(el('h3', '', item.title), el('p', 'muted', `${item.kind} · ${item.createdAt.slice(0, 10)} · ${item.trust}`));
      const open = el('button', 'btn', () => t('Read note')) as HTMLButtonElement;
      open.type = 'button';
      open.addEventListener('click', () => void (async () => {
        open.disabled = true;
        try {
          const note = await run(api.eccReadMemory(selected, item.kind, item.id));
          if (selected !== chosen() || token !== request) return;
          detail.replaceChildren();
          if (note) {
            detail.append(el('h3', '', note.title));
            const content = el('pre', 'ecc-memory-note', note.body);
            content.style.whiteSpace = 'pre-wrap';
            content.style.overflowWrap = 'anywhere';
            detail.append(content);
          }
        } finally { if (open.isConnected) open.disabled = false; }
      })());
      card.append(text, open); entries.append(card);
    }
  };
  const load = async (): Promise<void> => {
    const selected = chosen(); const token = ++request;
    entries.replaceChildren(); detail.replaceChildren();
    if (!selected) return;
    const text = search.value.trim();
    const notes = await run(text ? api.eccSearchMemories(selected, text) : api.eccListMemories(selected));
    if (notes) showMemories(notes, selected, token);
  };
  const refreshProjects = async (): Promise<void> => {
    const before = chosen();
    const projects = await run(api.listProjects());
    if (!projects) return;
    const active = projects.filter(item => !item.ungrouped);
    project.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = t('Choose a project');
    project.append(placeholder);
    for (const item of active) {
      const option = document.createElement('option'); option.value = item.id; option.textContent = item.name;
      project.append(option);
    }
    emptyProjects.hidden = active.length > 0;
    const hint = document.getElementById('eccProjectHint');
    if (hint) hint.textContent = active.length ? t('Select a project to manage its learning and notes.')
      : t('Add a project folder to start learning. Your existing files will not be changed.');
    project.value = active.some(item => item.id === before) ? before : '';
    findings.replaceChildren();
    await load();
    refreshLearning();
  };

  project.addEventListener('change', () => { findings.replaceChildren(); void load(); refreshLearning(); });
  search.addEventListener('input', () => { /* Search runs only on explicit button/Enter. */ });
  search.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void load(); } });
  query.addEventListener('click', () => void load());
  save.addEventListener('click', () => void (async () => {
    const selected = chosen();
    if (!selected || !title.value.trim() || !body.value.trim()) { toast(t('Choose a project and enter a title and note.')); return; }
    save.disabled = true;
    try {
      const added = await run(api.eccSaveMemory(selected, {
        kind: kind.value as EccMemoryKind, title: title.value.trim(), body: body.value
      }));
      if (added) { title.value = ''; body.value = ''; toast(t('Project knowledge saved.')); await load(); }
    } finally { save.disabled = false; }
  })());
  audit.addEventListener('click', () => void (async () => {
    const selected = chosen();
    if (!selected) { toast(t('Choose a project')); return; }
    audit.disabled = true; findings.replaceChildren();
    try {
      const report = await run(api.eccSecurityAudit(selected));
      if (!report || chosen() !== selected) return;
      findings.append(el('p', 'muted', `${report.filesScanned} files · ${report.findings.length} findings${report.partial ? ' · Partial scan' : ''}`));
      if (!report.findings.length) findings.append(el('p', 'muted', () => t('No findings in inspected files.')));
      for (const item of report.findings) {
        const card = el('article', 'plugin-card');
        card.append(el('strong', '', `${item.severity.toUpperCase()} · ${item.rule}`));
        card.append(el('p', 'muted', `${item.path}:${item.line}`));
        card.append(el('p', '', item.explanation));
        findings.append(card);
      }
    } finally { audit.disabled = false; }
  })());
  void refreshProjects();
  return () => { void refreshProjects(); refreshLearning(); };
}

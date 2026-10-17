import type { AppApi } from '../preload/index.js';
import type { EccLearningCorrection } from '../shared/ecc-learning.js';
import { el, run, toast } from './dom.js';
import { t } from './i18n.js';

/** All actions require a current explicit project choice; stale results are discarded. */
export function initEccLearningUi(api: AppApi, chosen: () => string): () => void {
  if (!document.getElementById('eccLearningEnabled') || typeof api.eccLearningStatus !== 'function')
    return () => undefined;
  const checkbox = document.getElementById('eccLearningEnabled') as HTMLInputElement;
  const status = document.getElementById('eccLearningStatus')!;
  const instincts = document.getElementById('eccLearningInstincts')!;
  const proposals = document.getElementById('eccLearningProposals')!;
  const bundle = document.getElementById('eccLearningBundle') as HTMLTextAreaElement;
  let version = 0;
  const current = (id: string, token: number) => id === chosen() && version === token;
  const refresh = async (): Promise<void> => {
    const id = chosen(), token = ++version;
    checkbox.disabled = !id;
    checkbox.checked = false;
    status.textContent = id ? t('Loading project learning…') : t('Choose a project first.');
    instincts.replaceChildren(); proposals.replaceChildren();
    if (!id) return;
    const [state, learned] = await Promise.all([
      run(api.eccLearningStatus(id)), run(api.eccLearningInstincts(id))
    ]);
    if (!current(id, token)) return;
    if (!state || !learned) { status.textContent = t('Could not load project learning.'); return; }
    checkbox.disabled = false;
    checkbox.checked = state.config.enabled;
    status.textContent = `${state.config.enabled ? 'Learning on' : 'Learning off'} · ${state.observationCount} observations · ${state.instinctCount} instincts · ${state.pendingObservations} awaiting analysis`;
    if (!learned.length) instincts.append(el('p', 'muted', t('No learned instincts yet. A minimum of 20 observations is required.')));
    for (const instinct of learned) {
      const card = el('article', 'plugin-card');
      card.append(el('strong', '', instinct.trigger), el('p', '', instinct.action));
      card.append(el('p', 'muted', `${Math.round(instinct.confidence * 100)}% confidence · ${instinct.supports} supports · ${instinct.source} · ${instinct.approved ? 'approved' : 'needs review'}`));
      if (instinct.source === 'observed' && (instinct.approved || (instinct.confidence >= 0.7 && instinct.supports >= 6))) {
        const button = el('button', 'btn', instinct.approved ? t('Revoke approval') : t('Approve for this project')) as HTMLButtonElement;
        button.type = 'button';
        button.addEventListener('click', () => void (async () => {
          if (!current(id, token) || !window.confirm(instinct.approved ? 'Stop applying this practice to the project?' : 'Approve this reviewed practice for use in this project?')) return;
          button.disabled = true;
          const reply = await run(api.eccLearningApprove(id, instinct.id, !instinct.approved));
          if (reply && id === chosen()) await refresh();
          else button.disabled = false;
        })());
        card.append(button);
      }
      instincts.append(card);
    }
  };
  const perform = (callback: (id: string) => Promise<unknown>) => async (): Promise<void> => {
    const id = chosen(); if (!id) { toast(t('Choose a project first.')); return; }
    await callback(id);
  };
  checkbox.addEventListener('change', () => void (async () => {
    const id = chosen(), enabled = checkbox.checked;
    if (!id) return;
    checkbox.disabled = true;
    if (!window.confirm(enabled
      ? 'Enable local continuous learning from tool outcomes in this project? Raw content is not collected.'
      : 'Disable continuous learning in this project? Existing instincts will be kept.')) {
      checkbox.checked = !enabled; checkbox.disabled = false; return;
    }
    const changed = await run(api.eccLearningConfigure(id, enabled));
    if (id === chosen()) await refresh();
    if (!changed) checkbox.checked = !enabled;
  })());
  document.getElementById('eccLearningRefresh')?.addEventListener('click', () => void refresh());
  document.getElementById('eccLearningRecordCorrection')?.addEventListener('click', () => void perform(async id => {
    const selector = document.getElementById('eccLearningCorrection') as HTMLSelectElement;
    if (!window.confirm('Record this correction for the selected project? Learning must be enabled.')) return;
    const recorded = await run(api.eccLearningCorrection(id, selector.value as EccLearningCorrection));
    if (recorded && id === chosen()) {
      toast(recorded.accepted ? t('Explicit learning preference recorded.') : t('Enable project learning to record corrections.'));
      await refresh();
    }
  })());
  document.getElementById('eccLearningEvolve')?.addEventListener('click', () => void perform(async id => {
    const token = version;
    const drafts = await run(api.eccLearningProposals(id));
    if (!drafts || !current(id, token)) return;
    proposals.replaceChildren();
    if (!drafts.length) proposals.append(el('p', 'muted', t('No reviewable evolution proposals yet.')));
    for (const draft of drafts) {
      const card = el('article', 'plugin-card');
      card.append(el('strong', '', `${draft.kind}: ${draft.title}`));
      const preview = el('pre', 'ecc-memory-note', draft.markdown);
      preview.style.whiteSpace = 'pre-wrap'; card.append(preview);
      card.append(el('p', 'muted', t('Draft only: not installed or executed.')));
      proposals.append(card);
    }
  })());
  document.getElementById('eccLearningExport')?.addEventListener('click', () => void perform(async id => {
    const exported = await run(api.eccLearningExport(id));
    if (exported && chosen() === id) { bundle.value = exported; toast(t('Local learning export prepared for review.')); }
  })());
  document.getElementById('eccLearningImport')?.addEventListener('click', () => void perform(async id => {
    const data = bundle.value.trim();
    if (!data || data.length > 32768) { toast(t('Choose a valid small JSON bundle first.')); return; }
    if (!window.confirm('Import these untrusted instincts into this selected project? Imported instincts are never auto-approved.')) return;
    const changed = await run(api.eccLearningImport(id, data));
    if (changed && chosen() === id) await refresh();
  })());
  document.getElementById('eccLearningReset')?.addEventListener('click', () => void perform(async id => {
    if (!window.confirm('Erase all recorded learning observations for this project? This cannot be undone without a backup.')) return;
    const changed = await run(api.eccLearningReset(id, 'observations'));
    if (changed && chosen() === id) await refresh();
  })());
  return () => { void refresh(); };
}

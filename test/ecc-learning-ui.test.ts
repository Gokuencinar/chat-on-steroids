import { afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

let dom: JSDOM | null = null;
afterEach(() => { dom?.window.close(); dom = null; vi.unstubAllGlobals(); vi.resetModules(); });

it('keeps ECC learning off by default and requires explicit project choice and consent', async () => {
  dom = new JSDOM(`<!doctype html><body>
    <input type="checkbox" id="eccLearningEnabled"><p id="eccLearningStatus"></p>
    <div id="eccLearningInstincts"></div><div id="eccLearningProposals"></div>
    <textarea id="eccLearningBundle"></textarea>
    <button id="eccLearningRefresh"></button><button id="eccLearningEvolve"></button>
    <button id="eccLearningExport"></button><button id="eccLearningImport"></button>
    <button id="eccLearningReset"></button><button id="eccLearningRecordCorrection"></button>
    <select id="eccLearningCorrection"><option value="test-after-edit">Test</option></select>
  </body>`, { url: 'https://cos.test/' });
  const w = dom.window;
  for (const [key, value] of Object.entries({ window: w, document: w.document, HTMLElement: w.HTMLElement,
    HTMLButtonElement: w.HTMLButtonElement, HTMLInputElement: w.HTMLInputElement,
    HTMLSelectElement: w.HTMLSelectElement, HTMLTextAreaElement: w.HTMLTextAreaElement })) vi.stubGlobal(key, value);
  let selected = '';
  const confirm = vi.fn(() => false);
  w.confirm = confirm;
  const status = vi.fn(async () => ({ ok: true as const, data: { config: { enabled: false }, observationCount: 0, instinctCount: 0, proposalCount: 0, pendingObservations: 0 } }));
  const instincts = vi.fn(async () => ({ ok: true as const, data: [] }));
  const configure = vi.fn(async () => ({ ok: true as const, data: { config: { enabled: true }, observationCount: 0, instinctCount: 0, proposalCount: 0, pendingObservations: 0 } }));
  const correction = vi.fn(async () => ({ ok: true as const, data: { accepted: true, reason: 'recorded', observationCount: 1 } }));
  const api = { eccLearningStatus: status, eccLearningInstincts: instincts, eccLearningConfigure: configure,
    eccLearningCorrection: correction };
  const { initEccLearningUi } = await import('../src/renderer/ecc-learning-ui.js');
  const refresh = initEccLearningUi(api as any, () => selected);
  refresh();
  expect((w.document.getElementById('eccLearningEnabled') as HTMLInputElement).disabled).toBe(true);
  w.document.getElementById('eccLearningRecordCorrection')!.click();
  expect(status).not.toHaveBeenCalled(); expect(correction).not.toHaveBeenCalled();
  selected = 'local-project'; refresh();
  await vi.waitFor(() => expect(status).toHaveBeenCalledWith('local-project'));
  await vi.waitFor(() => expect((w.document.getElementById('eccLearningEnabled') as HTMLInputElement).disabled).toBe(false));
  const checkbox = w.document.getElementById('eccLearningEnabled') as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  checkbox.checked = true; checkbox.dispatchEvent(new w.Event('change'));
  await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(configure).not.toHaveBeenCalled();
  expect(checkbox.checked).toBe(false);
  confirm.mockReturnValueOnce(true);
  w.document.getElementById('eccLearningRecordCorrection')!.click();
  await vi.waitFor(() => expect(correction).toHaveBeenCalledWith('local-project', 'test-after-edit'));
  selected = ''; refresh();
  expect(checkbox.disabled).toBe(true);
});

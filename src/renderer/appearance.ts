import { defaultAppearance, mixColor, paletteTokens, presetAppearance, type AppearancePreset, type AppearanceSettings, type AppearanceTheme } from '../shared/appearance.js';
import type { UiPrefs } from '../shared/types.js';
import { $ } from './dom.js';
import { t, uiText } from './i18n.js';

const FONT_FAMILIES = {
  system: '', sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif', mono: '"Cascadia Mono", Consolas, monospace'
};
const appearanceListeners = new Set<() => void>();
/** Canvas/terminal renderers must refresh after the CSS palette has been applied. */
export function onAppearanceChanged(listener: () => void): () => void {
  appearanceListeners.add(listener);
  return () => { appearanceListeners.delete(listener); };
}
function tokens(element: HTMLElement, values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) if (element.style.getPropertyValue(key) !== value) element.style.setProperty(key, value);
}

export function applyAppearance(theme: AppearanceTheme, settings?: AppearanceSettings): void {
  const value = settings ?? defaultAppearance(), palette = value[theme], root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.appearanceStyle = value.style ?? 'classic';
  root.dataset.translucentSidebar = String(value.translucentSidebar);
  tokens(root, paletteTokens(palette.background, palette.accent, palette.contrast));
  root.style.setProperty('--text-scale', String(value.fontSize / 14));
  if (value.font === 'system') root.style.removeProperty('--ui-font');
  else root.style.setProperty('--ui-font', FONT_FAMILIES[value.font]);
  root.style.setProperty('--sidebar-color', palette.sidebar);
  // Glass is composed inside the window: a colored backdrop and translucent layer.
  // No native transparent window, desktop capture, or platform permission is needed.
  const sidebarBackground = value.translucentSidebar ? mixColor(palette.sidebar, palette.background, .13) : palette.sidebar;
  for (const element of document.querySelectorAll<HTMLElement>('.sidebar, .app-topbar, .appearance-preview-sidebar, .connection-popover')) {
    tokens(element, paletteTokens(sidebarBackground, palette.accent, palette.contrast));
  }
  for (const listener of appearanceListeners) listener();
}

/** Only the in-progress form edit is local; the existing Settings queue owns persistence. */
export function initAppearance(save: (patch: { theme?: AppearanceTheme; appearance?: AppearanceSettings }) => void): { apply(ui: UiPrefs): void } {
  const panel = $('appearancePanel');
  let theme: AppearanceTheme = 'dark';
  let current = defaultAppearance();
  let editing = false;
  const presets: { id: AppearancePreset; title: () => string; detail: () => string }[] = [
    { id: 'classic', title: () => t('Classic'), detail: () => t('Balanced default') },
    { id: 'cyberpunk', title: () => t('Cyberpunk'), detail: () => t('Neon nightlife') },
    { id: 'gamer', title: () => t('Gamer'), detail: () => t('Arcade energy') },
    { id: 'futuristic', title: () => t('Futuristic'), detail: () => t('Cool glass') },
    { id: 'win95', title: () => t('Windows 95'), detail: () => t('Pixel nostalgia') },
    { id: 'terminal', title: () => t('Retro Terminal'), detail: () => t('Green phosphor') },
    { id: 'synthwave', title: () => t('Synthwave'), detail: () => t('Purple sunset') },
    { id: 'midnight', title: () => t('Midnight OLED'), detail: () => t('Pure black') },
    { id: 'solar', title: () => t('Solar'), detail: () => t('Warm daylight') }
  ];
  const presetGrid = $('appearancePresets');
  for (const { id, title, detail } of presets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'appearance-preset';
    button.dataset.preset = id;
    const sample = presetAppearance(id)[id === 'win95' || id === 'solar' ? 'light' : 'dark'];
    button.style.setProperty('--preset-page', sample.background);
    button.style.setProperty('--preset-side', sample.sidebar);
    button.style.setProperty('--preset-accent', sample.accent);
    const thumbnail = document.createElement('span');
    thumbnail.className = 'appearance-preset-thumbnail';
    thumbnail.setAttribute('aria-hidden', 'true');
    for (const part of ['sidebar', 'topbar', 'card', 'accent'] as const) {
      const section = document.createElement('span');
      section.className = `appearance-preset-${part}`;
      thumbnail.append(section);
    }
    const caption = document.createElement('span');
    caption.className = 'appearance-preset-caption';
    const name = document.createElement('strong');
    name.append(uiText(title));
    const description = document.createElement('span');
    description.append(uiText(detail));
    caption.append(name, description);
    button.append(thumbnail, caption);
    presetGrid.append(button);
  }
  presetGrid.addEventListener('click', event => {
    const target = event.target;
    const button = target instanceof Element ? target.closest<HTMLButtonElement>('button[data-preset]') : null;
    if (!button) return;
    const id = button.dataset.preset as AppearancePreset;
    editing = false;
    current = presetAppearance(id);
    theme = id === 'win95' || id === 'solar' ? 'light' : 'dark';
    paint();
    save({ theme, appearance: current });
  });
  const colorKeys = ['accent', 'background', 'sidebar'] as const;
  function paint(): void {
    applyAppearance(theme, current);
    for (const button of presetGrid.querySelectorAll<HTMLButtonElement>('button[data-preset]')) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === (current.style ?? 'classic')));
    }
    $<HTMLSelectElement>('appearanceTheme').value = theme;
    $<HTMLSelectElement>('appearanceFont').value = current.font;
    $<HTMLInputElement>('appearanceSize').value = String(current.fontSize);
    $('appearanceSizeValue').textContent = `${current.fontSize} px`;
    $<HTMLInputElement>('appearanceContrast').value = String(current[theme].contrast);
    $('appearanceContrastValue').textContent = String(current[theme].contrast);
    $<HTMLInputElement>('appearanceTranslucent').checked = current.translucentSidebar;
    for (const key of colorKeys) {
      const color = current[theme][key];
      panel.querySelector<HTMLInputElement>(`[data-color="${key}"]`)!.value = color;
      const hex = panel.querySelector<HTMLInputElement>(`[data-hex="${key}"]`)!;
      if (document.activeElement !== hex) hex.value = color.toUpperCase();
    }
  }
  function update(control: HTMLInputElement | HTMLSelectElement): boolean {
    if (control.dataset.color || control.dataset.hex) {
      const key = (control.dataset.color ?? control.dataset.hex) as typeof colorKeys[number];
      const value = control.value.trim();
      if (!/^#[\da-fA-F]{6}$/.test(value)) {
        control.setAttribute('aria-invalid', 'true');
        return false;
      }
      control.removeAttribute('aria-invalid');
      current = { ...current, [theme]: { ...current[theme], [key]: value.toLowerCase() } };
      // Keep the hex text in sync with native picker gestures too.
      if (control.dataset.color) panel.querySelector<HTMLInputElement>(`[data-hex="${key}"]`)!.value = value.toUpperCase();
    } else if (control.id === 'appearanceSize') current = { ...current, fontSize: Number(control.value) };
    else if (control.id === 'appearanceContrast') current = { ...current, [theme]: { ...current[theme], contrast: Number(control.value) } };
    else if (control.id === 'appearanceFont') current = { ...current, font: control.value as AppearanceSettings['font'] };
    else if (control.id === 'appearanceTranslucent') current = { ...current, translucentSidebar: (control as HTMLInputElement).checked };
    else return false;
    paint();
    return true;
  }
  panel.addEventListener('input', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement) || !control.id.startsWith('appearance')) return;
    editing = true;
    update(control);
  });
  panel.addEventListener('change', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement) || !control.id.startsWith('appearance')) return;
    editing = false;
    if (control.id === 'appearanceTheme') {
      theme = control.value as AppearanceTheme;
      paint(); save({ theme });
    } else if (update(control)) save({ appearance: current });
    else {
      // Incomplete hex input never becomes CSS or durable config. Restore the last valid value.
      control.removeAttribute('aria-invalid');
      if (control.dataset.hex) control.value = current[theme][control.dataset.hex as typeof colorKeys[number]].toUpperCase();
    }
  });
  $('appearanceReset').addEventListener('click', () => {
    editing = false; current = defaultAppearance(); paint(); save({ appearance: current });
  });
  return { apply(ui) {
    if (editing) return;
    theme = ui.theme; current = ui.appearance ?? defaultAppearance(); paint();
  } };
}

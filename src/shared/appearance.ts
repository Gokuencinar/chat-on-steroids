/** Saved appearance is presentation only. Theme remains the existing ui.theme choice. */
export const APPEARANCE_FONTS = ['system', 'sans', 'serif', 'mono'] as const;
export const APPEARANCE_STYLES = [
  'classic', 'cyberpunk', 'gamer', 'futuristic', 'win95',
  'terminal', 'synthwave', 'midnight', 'solar'
] as const;
export type AppearancePreset = typeof APPEARANCE_STYLES[number];
export type AppearanceTheme = 'light' | 'dark';
export interface AppearancePalette {
  background: string;
  sidebar: string;
  accent: string;
  contrast: number;
}
export interface AppearanceSettings {
  /** Optional so appearance saved before styles existed still loads as Classic. */
  style?: AppearancePreset;
  light: AppearancePalette;
  dark: AppearancePalette;
  font: typeof APPEARANCE_FONTS[number];
  fontSize: number;
  translucentSidebar: boolean;
}
export function defaultAppearance(): AppearanceSettings {
  return {
    style: 'classic',
    light: { background: '#f4f4f5', sidebar: '#e9edf2', accent: '#486f9d', contrast: 45 },
    dark: { background: '#181818', sidebar: '#1a2129', accent: '#b0cbed', contrast: 60 },
    font: 'system', fontSize: 14, translucentSidebar: true
  };
}

/** Complete editable palettes; CSS owns only the decorative shape of each style. */
const PRESETS: Record<Exclude<AppearancePreset, 'classic'>, Omit<AppearanceSettings, 'style'>> = {
  cyberpunk: {
    light: { background: '#fff0fa', sidebar: '#e7dcfc', accent: '#a00091', contrast: 75 },
    dark: { background: '#100b21', sidebar: '#1c1030', accent: '#ff38c8', contrast: 90 },
    font: 'mono', fontSize: 14, translucentSidebar: false
  },
  gamer: {
    light: { background: '#edf7f0', sidebar: '#d5e9dd', accent: '#186839', contrast: 68 },
    dark: { background: '#0b1210', sidebar: '#101e19', accent: '#56f595', contrast: 85 },
    font: 'sans', fontSize: 14, translucentSidebar: false
  },
  futuristic: {
    light: { background: '#edf7ff', sidebar: '#dceefa', accent: '#176b93', contrast: 55 },
    dark: { background: '#0a1827', sidebar: '#10283c', accent: '#69e0ff', contrast: 76 },
    font: 'sans', fontSize: 14, translucentSidebar: true
  },
  win95: {
    light: { background: '#c0c0c0', sidebar: '#b6b6b6', accent: '#000080', contrast: 90 },
    dark: { background: '#252b34', sidebar: '#353d49', accent: '#83b5ff', contrast: 88 },
    font: 'sans', fontSize: 14, translucentSidebar: false
  },
  terminal: {
    light: { background: '#eff7e8', sidebar: '#d9e7ce', accent: '#27672e', contrast: 85 },
    dark: { background: '#07110a', sidebar: '#0b190e', accent: '#63ea86', contrast: 90 },
    font: 'mono', fontSize: 14, translucentSidebar: false
  },
  synthwave: {
    light: { background: '#fff1fc', sidebar: '#eddafc', accent: '#ab2788', contrast: 70 },
    dark: { background: '#1c1030', sidebar: '#29133e', accent: '#ff79d6', contrast: 80 },
    font: 'sans', fontSize: 14, translucentSidebar: true
  },
  midnight: {
    light: { background: '#f0f0fa', sidebar: '#e5e7f6', accent: '#5652a5', contrast: 55 },
    dark: { background: '#000000', sidebar: '#0b0c14', accent: '#b7a5ff', contrast: 70 },
    font: 'system', fontSize: 14, translucentSidebar: false
  },
  solar: {
    light: { background: '#fbf5e7', sidebar: '#efe1c8', accent: '#956025', contrast: 62 },
    dark: { background: '#242017', sidebar: '#2e2a20', accent: '#efbb72', contrast: 72 },
    font: 'serif', fontSize: 14, translucentSidebar: false
  }
};

/** New mutable palettes on every selection; edits cannot modify the shared catalog. */
export function presetAppearance(style: AppearancePreset): AppearanceSettings {
  const source = style === 'classic' ? defaultAppearance() : PRESETS[style];
  return { ...source, light: { ...source.light }, dark: { ...source.dark }, style };
}

/** Compatibility entry point for the existing Cyberpunk button and callers. */
export function cyberpunkAppearance(current = defaultAppearance()): AppearanceSettings {
  return { ...current, ...presetAppearance('cyberpunk') };
}

/** Field-wise three-way merge, so an unrelated save cannot undo another window's colors. */
export function mergeAppearance(live: AppearanceSettings | undefined, base: AppearanceSettings | undefined,
  wanted: AppearanceSettings | undefined): AppearanceSettings | undefined {
  if (!wanted) return live;
  const current = live ?? defaultAppearance(), before = base ?? defaultAppearance();
  const pick = <T>(a: T, b: T, c: T): T => Object.is(b, c) ? a : c;
  const palette = (theme: AppearanceTheme): AppearancePalette => ({
    background: pick(current[theme].background, before[theme].background, wanted[theme].background),
    sidebar: pick(current[theme].sidebar, before[theme].sidebar, wanted[theme].sidebar),
    accent: pick(current[theme].accent, before[theme].accent, wanted[theme].accent),
    contrast: pick(current[theme].contrast, before[theme].contrast, wanted[theme].contrast)
  });
  return { style: wanted.style === undefined ? current.style : pick(current.style ?? 'classic', before.style ?? 'classic', wanted.style),
    light: palette('light'), dark: palette('dark'), font: pick(current.font, before.font, wanted.font),
    fontSize: pick(current.fontSize, before.fontSize, wanted.fontSize),
    translucentSidebar: pick(current.translucentSidebar, before.translucentSidebar, wanted.translucentSidebar) };
}

function channels(hex: string): number[] {
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}
export function mixColor(a: string, b: string, amount: number): string {
  const right = channels(b);
  return '#' + channels(a).map((value, i) => Math.round(value + (right[i]! - value) * amount)
    .toString(16).padStart(2, '0')).join('');
}
export function luminance(color: string): number {
  const linear = channels(color).map(value => {
    const n = value / 255;
    return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  });
  return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722;
}
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function readableInk(background: string): string {
  return contrastRatio(background, '#ffffff') > contrastRatio(background, '#000000') ? '#ffffff' : '#000000';
}
function readableTint(color: string, background: string, ratio: number): string {
  const ink = readableInk(background);
  for (let step = 0; step <= 20; step++) {
    const candidate = mixColor(color, ink, step / 20);
    if (contrastRatio(candidate, background) >= ratio) return candidate;
  }
  return ink;
}

/** One palette feeds existing semantic CSS tokens, including independently colored sidebars. */
export function paletteTokens(background: string, accent: string, contrast: number): Record<string, string> {
  const ink = readableInk(background), c = contrast / 100;
  const card = mixColor(background, ink, .025 + .06 * c);
  const hover = mixColor(background, ink, .055 + .07 * c);
  return {
    '--page': background, '--ink': ink, '--card': card, '--sunk': mixColor(background, ink, .018 + .025 * c),
    '--hover': hover, '--raise': hover, '--popover': mixColor(background, ink, .06 + .06 * c),
    '--soft': readableTint(mixColor(background, ink, .53 + .2 * c), card, 4.5),
    '--faint': readableTint(mixColor(background, ink, .43 + .2 * c), card, 4.5),
    '--line': mixColor(background, ink, .09 + .13 * c), '--edge': mixColor(background, ink, .12 + .15 * c),
    '--track': mixColor(background, ink, .18 + .14 * c),
    '--blue': readableTint(accent, background, 4.5), '--accent': readableTint(accent, background, 4.5),
    '--accent-fill': accent, '--on-accent': readableInk(accent),
    '--wash': mixColor(background, accent, .12), '--blue-line': mixColor(background, accent, .3),
    '--accent-wash': mixColor(background, accent, .12), '--accent-edge': mixColor(background, accent, .35),
    '--knob-off': ink, '--knob-on': readableInk(accent),
    '--green': readableTint('#258552', card, 4.5), '--green-wash': mixColor(background, '#258552', .12),
    '--green-line': mixColor(background, '#258552', .3),
    '--red': readableTint('#d44545', card, 4.5), '--red-wash': mixColor(background, '#d44545', .12),
    '--red-line': mixColor(background, '#d44545', .3)
  };
}

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
    light: { background: '#fff0fb', sidebar: '#f3d9fd', accent: '#a00086', contrast: 82 },
    dark: { background: '#090516', sidebar: '#210d35', accent: '#ff35cb', contrast: 95 },
    font: 'mono', fontSize: 14, translucentSidebar: false
  },
  gamer: {
    light: { background: '#f1f2ff', sidebar: '#e1defb', accent: '#6430cf', contrast: 78 },
    dark: { background: '#080917', sidebar: '#14112e', accent: '#b6ff26', contrast: 96 },
    font: 'sans', fontSize: 14, translucentSidebar: false
  },
  futuristic: {
    light: { background: '#f3fcff', sidebar: '#d9f2ff', accent: '#0077ae', contrast: 75 },
    dark: { background: '#061629', sidebar: '#102e48', accent: '#9af4ff', contrast: 92 },
    font: 'sans', fontSize: 14, translucentSidebar: true
  },
  win95: {
    light: { background: '#c4c4c4', sidebar: '#b5b5b5', accent: '#000080', contrast: 95 },
    dark: { background: '#232935', sidebar: '#323b4a', accent: '#a1c8ff', contrast: 92 },
    font: 'sans', fontSize: 14, translucentSidebar: false
  },
  terminal: {
    light: { background: '#edf9e8', sidebar: '#d4eecb', accent: '#286b2e', contrast: 92 },
    dark: { background: '#020b05', sidebar: '#071709', accent: '#66ff86', contrast: 96 },
    font: 'mono', fontSize: 14, translucentSidebar: false
  },
  synthwave: {
    light: { background: '#fff1fb', sidebar: '#f0d6f6', accent: '#a72583', contrast: 78 },
    dark: { background: '#170a2a', sidebar: '#321344', accent: '#ff73d3', contrast: 89 },
    font: 'sans', fontSize: 14, translucentSidebar: true
  },
  midnight: {
    light: { background: '#f2f3fc', sidebar: '#e1e5f6', accent: '#524a9e', contrast: 73 },
    dark: { background: '#000000', sidebar: '#07070d', accent: '#c6afff', contrast: 84 },
    font: 'system', fontSize: 14, translucentSidebar: false
  },
  solar: {
    light: { background: '#fff9e9', sidebar: '#f1e1c4', accent: '#915213', contrast: 77 },
    dark: { background: '#211c15', sidebar: '#352919', accent: '#ffd18a', contrast: 85 },
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

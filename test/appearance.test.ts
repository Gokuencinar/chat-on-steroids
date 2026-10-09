import { describe, it, expect } from 'vitest';
import { appearanceSchema } from '../src/main/appearance-schema.js';
import { APPEARANCE_STYLES, cyberpunkAppearance, defaultAppearance, mergeAppearance,
  mixColor, paletteTokens, presetAppearance, contrastRatio, readableInk } from '../src/shared/appearance.js';
import { titleBarOverlayForTheme, windowBackgroundForTheme } from '../src/main/window-layout.js';

describe('custom appearance', () => {
  it('retains a concurrent skin change when an older window saves only its color preferences', () => {
    const base = defaultAppearance(), live = cyberpunkAppearance(base), wanted = defaultAppearance();
    delete wanted.style;
    wanted.light.accent = '#7700ee';
    const merged = mergeAppearance(live, base, wanted)!;
    expect(merged.style).toBe('cyberpunk');
    expect(merged.dark).toEqual(live.dark);
    expect(merged.light.accent).toBe('#7700ee');
    expect(appearanceSchema.safeParse({ ...live, style: 'url(remote)' }).success).toBe(false);
    expect(appearanceSchema.parse(wanted).style).toBeUndefined();
  });

  it('accepts all nine style IDs while keeping older appearance objects valid', () => {
    expect(APPEARANCE_STYLES).toEqual([
      'classic', 'cyberpunk', 'gamer', 'futuristic', 'win95',
      'terminal', 'synthwave', 'midnight', 'solar'
    ]);
    const legacy = defaultAppearance();
    delete legacy.style;
    expect(appearanceSchema.parse(legacy)).toEqual(legacy);
    for (const style of APPEARANCE_STYLES) {
      const appearance = { ...legacy, style };
      expect(appearanceSchema.parse(appearance)).toEqual(appearance);
    }
    for (const invalid of ['remote-font', 'gamer;display:none', 'url(https://example.com)', '', null]) {
      expect(appearanceSchema.safeParse({ ...legacy, style: invalid }).success, String(invalid)).toBe(false);
    }
  });

  it('returns independent, valid, readable palettes and text for every style', () => {
    for (const style of APPEARANCE_STYLES) {
      const first = presetAppearance(style);
      const second = presetAppearance(style);
      expect(first.style).toBe(style);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.light).not.toBe(second.light);
      expect(first.dark).not.toBe(second.dark);
      expect(appearanceSchema.parse(first)).toEqual(first);
      expect(first).not.toHaveProperty('preset');
      for (const theme of ['light', 'dark'] as const) {
        const palette = first[theme];
        const page = paletteTokens(palette.background, palette.accent, palette.contrast);
        const sidebar = first.translucentSidebar
          ? mixColor(palette.sidebar, palette.background, .13)
          : palette.sidebar;
        const sidebarTokens = paletteTokens(sidebar, palette.accent, palette.contrast);
        expect(contrastRatio(page['--ink']!, palette.background), style).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(page['--soft']!, page['--card']!), style).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(page['--faint']!, page['--card']!), style).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(page['--accent']!, palette.background), style).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(page['--on-accent']!, palette.accent), style).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(sidebarTokens['--ink']!, sidebar), style).toBeGreaterThanOrEqual(4.5);
      }
      first.light.background = '#123456';
      first.dark.accent = '#ffffff';
      expect(second).toEqual(presetAppearance(style));
    }
    expect(presetAppearance('classic')).toEqual(defaultAppearance());
  });

  it('keeps cyberpunkAppearance compatible while applying both neon palettes and typography', () => {
    const original = defaultAppearance();
    original.font = 'serif';
    original.fontSize = 18;
    original.light.background = '#123456';
    const cyberpunk = cyberpunkAppearance(original);
    expect(cyberpunk).toEqual(presetAppearance('cyberpunk'));
    expect(cyberpunk.light).toEqual({
      background: '#fff0fa', sidebar: '#e7dcfc', accent: '#a00091', contrast: 75
    });
    expect(cyberpunk.dark).toEqual({
      background: '#100b21', sidebar: '#1c1030', accent: '#ff38c8', contrast: 90
    });
    expect(cyberpunk).toMatchObject({ style: 'cyberpunk', font: 'mono', fontSize: 14, translucentSidebar: false });
    expect(original).toMatchObject({ style: 'classic', font: 'serif', fontSize: 18 });
    expect(original.light.background).toBe('#123456');
    expect(cyberpunkAppearance()).toEqual(cyberpunk);
  });

  it('merges style changes independently of palettes and preserves missing legacy style', () => {
    const base = defaultAppearance(), live = presetAppearance('gamer');
    const stale = { ...base, fontSize: 17 };
    expect(mergeAppearance(live, base, stale)).toMatchObject({
      style: 'gamer', fontSize: 17, dark: live.dark
    });
    const edited = { ...base, dark: { ...base.dark, accent: '#123456' }, style: 'synthwave' as const };
    const merged = mergeAppearance(live, base, edited)!;
    expect(merged.style).toBe('synthwave');
    expect(merged.dark.accent).toBe('#123456');
    expect(merged.dark.background).toBe(live.dark.background);

    const legacy = defaultAppearance();
    delete legacy.style;
    const wanted = { ...legacy, dark: { ...legacy.dark, accent: '#654321' } };
    expect(mergeAppearance(live, legacy, wanted)).toMatchObject({
      style: 'gamer', dark: { ...live.dark, accent: '#654321' }
    });
    const legacyLive = defaultAppearance();
    delete legacyLive.style;
    expect(mergeAppearance(legacyLive, legacy, wanted)!.style).toBeUndefined();
  });

  it('accepts arbitrary RGB colors, including identical accent and background, and bounds other preferences', () => {
    const appearance = defaultAppearance();
    appearance.dark = { background: '#51a20F', sidebar: '#fE0193', accent: '#51a20F', contrast: 0 };
    expect(appearanceSchema.parse(appearance)).toEqual(appearance);
    for (const bad of ['red', '#fff', '#12345678', 'url(https://example.com)', '#abcdef;display:none']) {
      expect(appearanceSchema.safeParse({ ...appearance, dark: { ...appearance.dark, sidebar: bad } }).success).toBe(false);
    }
    for (const fontSize of [11, 19, 14.5, Infinity]) expect(appearanceSchema.safeParse({ ...appearance, fontSize }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...appearance, font: 'remote-font' }).success).toBe(false);
  });

  it('retains readable text and buttons across light, dark and vivid custom backgrounds', () => {
    for (const background of ['#000000', '#ffffff', '#777777', '#ff0000', '#00ff00', '#0000ff', '#fea5cf']) {
      for (const contrast of [0, 45, 100]) {
        const tokens = paletteTokens(background, background, contrast);
        expect(contrastRatio(tokens['--ink']!, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tokens['--soft']!, tokens['--card']!)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tokens['--faint']!, tokens['--card']!)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tokens['--blue']!, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tokens['--on-accent']!, background)).toBeGreaterThanOrEqual(4.5);
        expect(tokens['--accent-fill']).toBe(background);
      }
    }
  });

  it('merges stale windows per color and per theme without overwriting concurrent edits', () => {
    const base = defaultAppearance(), live = defaultAppearance(), wanted = defaultAppearance();
    live.dark.sidebar = '#ff0066'; live.light.background = '#f1f2f3'; live.font = 'serif';
    wanted.dark.accent = '#7600ff'; wanted.fontSize = 18;
    const merged = mergeAppearance(live, base, wanted)!;
    expect(merged.dark).toEqual({ ...live.dark, accent: '#7600ff' });
    expect(merged.light).toEqual(live.light);
    expect(merged.font).toBe('serif'); expect(merged.fontSize).toBe(18);
    expect(mergeAppearance(live, undefined, undefined)).toBe(live);
    expect(base).toEqual(defaultAppearance());
  });

  it('uses the custom sidebar for native caption contrast and the custom page for reload backing', () => {
    const appearance = defaultAppearance();
    appearance.dark.sidebar = '#ffffff'; appearance.dark.background = '#391c56'; appearance.translucentSidebar = false;
    expect(titleBarOverlayForTheme('dark', appearance)).toEqual({ height: 36, color: '#00000000', symbolColor: readableInk('#ffffff') });
    expect(windowBackgroundForTheme('dark', appearance)).toBe('#391c56');
  });
});

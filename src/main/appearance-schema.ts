import { z } from 'zod';
import { APPEARANCE_FONTS, APPEARANCE_STYLES } from '../shared/appearance.js';

const color = z.string().regex(/^#[\da-fA-F]{6}$/);
const palette = z.object({ background: color, sidebar: color, accent: color, contrast: z.number().int().min(0).max(100) });
/** Disk and Settings IPC validation: optional style preserves legacy saves; no authored CSS or remote fonts. */
export const appearanceSchema = z.object({
  style: z.enum(APPEARANCE_STYLES).optional(),
  light: palette, dark: palette, font: z.enum(APPEARANCE_FONTS),
  fontSize: z.number().int().min(12).max(18), translucentSidebar: z.boolean()
});

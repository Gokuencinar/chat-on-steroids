/**
 * ChatGPT's own Markdown directives, which its page renders and plain Markdown does not.
 *
 * `::chatgpt-content-reference{index="0" source_message_id="…"}` points at another message's
 * content (#574); for some accounts every reply arrives that way. `:::writing{…}` is a card the
 * renderer draws itself. Any other directive is unknown to this app, and ChatGPT keeps adding them
 * per account, so instead of shipping one fix per new name: a leaf directive line or an unknown
 * container is replaced by the page's own recorded rendering, and dropped from text otherwise.
 */
const LEAF_DIRECTIVE_LINE = /^[ \t]*::[a-z][\w-]*(?:\{[^}\n]*\})?[ \t]*$/i;
const UNKNOWN_CONTAINER_OPEN_LINE = /^[ \t]*:::(?!writing\b)[a-z][\w-]*(?:\{[^}\n]*\})?[ \t]*$/i;
const WRITING_CONTAINER_OPEN_LINE = /^[ \t]*:::writing\b(?:\{[^}\n]*\})?[ \t]*$/i;
const CONTAINER_CLOSE_LINE = /^[ \t]*:::[ \t]*$/;
const ANY_DIRECTIVE_TEXT = /(^|\n)[ \t]*:{2,3}[a-z][\w-]*(?:\{[^}\n]*\})?[ \t]*(?=\n|$)/i;

type ContainerKind = 'unknown' | 'writing';

/**
 * Walk directive-shaped lines while respecting Markdown fences and pairing container closes.
 * A blanket `:::` removal corrupts supported writing blocks whenever an unknown container is also
 * present, and line regexes alone mistake literal examples inside fenced code for provider syntax.
 */
function providerDirectives(text: string): { found: boolean; stripped: string } {
  const lines = text.split('\n');
  const kept: string[] = [];
  const containers: ContainerKind[] = [];
  let fence: { marker: '`' | '~'; length: number } | null = null;
  let found = false;

  for (const line of lines) {
    const fenceMatch = line.match(/^[ \t]*(`{3,}|~{3,})/);
    const fenceToken = fenceMatch?.[1];
    if (fence) {
      kept.push(line);
      if (fenceToken && fenceToken[0] === fence.marker && fenceToken.length >= fence.length) fence = null;
      continue;
    }
    if (fenceToken) {
      fence = { marker: fenceToken[0] as '`' | '~', length: fenceToken.length };
      kept.push(line);
      continue;
    }
    if (UNKNOWN_CONTAINER_OPEN_LINE.test(line)) {
      found = true;
      containers.push('unknown');
      kept.push('');
      continue;
    }
    if (WRITING_CONTAINER_OPEN_LINE.test(line)) {
      containers.push('writing');
      kept.push(line);
      continue;
    }
    if (CONTAINER_CLOSE_LINE.test(line) && containers.length) {
      const kind = containers.pop();
      kept.push(kind === 'writing' ? line : '');
      continue;
    }
    if (LEAF_DIRECTIVE_LINE.test(line)) {
      found = true;
      kept.push('');
      continue;
    }
    kept.push(line);
  }

  return { found, stripped: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

/** True when the text carries a directive this app cannot render itself. */
export function hasProviderDirective(text: string): boolean {
  return providerDirectives(text).found;
}

/** The text without unknown directive lines; an unknown container keeps its inner text. */
export function withoutProviderDirectives(text: string): string {
  return providerDirectives(text).stripped;
}

/** A recorded page rendering that shows content, not the same raw directives. */
export function resolvedCapture(capture?: { text: string; truncated?: boolean } | null): capture is { text: string; truncated?: boolean } {
  return !!capture?.text && !capture.truncated && !ANY_DIRECTIVE_TEXT.test(plainTextOfHtml(capture.text));
}

export function hasContentReference(text: string): boolean {
  return hasProviderDirective(text);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Plain text of captured message HTML: block ends become line breaks, tags go, entities decode. */
export function plainTextOfHtml(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|pre|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (entity, name: string) => {
      if (name.startsWith('#x') || name.startsWith('#X')) return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (name.startsWith('#') && name !== '#39') return String.fromCodePoint(Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? entity;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The reply as a model should read it: the page's resolved content when directives replaced it. */
export function modelFacingText(text: string, capture?: { text: string; truncated?: boolean } | null): string {
  if (!hasProviderDirective(text)) return text;
  if (resolvedCapture(capture)) {
    const resolved = plainTextOfHtml(capture.text);
    if (resolved) return resolved;
  }
  return withoutProviderDirectives(text) || '[This reply points to content from another message that was not recorded.]';
}

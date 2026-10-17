/** Web mic authorization is limited to ChatGPT's first-party composer in the
 * isolated CoS-browser partition. This is NOT permission for the CoS renderer,
 * other websites, cross-origin frames, video or arbitrary extensions. */
export function chatGptAudioPermission(pageUrl: string, permission: string, mediaTypes: readonly string[]): boolean {
  if (permission !== 'media' || mediaTypes.length !== 1 || mediaTypes[0] !== 'audio') return false;
  try { return new URL(pageUrl).origin === 'https://chatgpt.com'; }
  catch { return false; }
}

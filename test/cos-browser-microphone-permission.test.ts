import { describe, expect, it } from 'vitest';
import { chatGptAudioPermission } from '../src/main/cos-browser/microphone-permission.js';

describe('CoS browser ChatGPT microphone: narrow audio-only origin', () => {
  it('accepts only ChatGPT HTTPS audio requests', () => {
    expect(chatGptAudioPermission('https://chatgpt.com/c/conversation', 'media', ['audio'])).toBe(true);
    for (const url of [
      'http://chatgpt.com/', 'https://chatgpt.com.evil.example/',
      'https://evil.example/?next=https://chatgpt.com', 'https://chatgpt.com:443.evil.example/',
      'https://platform.openai.com/', 'file:///index.html', 'javascript:alert(1)', ''
    ]) expect(chatGptAudioPermission(url, 'media', ['audio'])).toBe(false);
  });
  it('refuses camera, mixed-media, unrelated permissions and empty media types', () => {
    const url = 'https://chatgpt.com/';
    for (const types of [[], ['video'], ['audio', 'video'], ['audio', 'audio']])
      expect(chatGptAudioPermission(url, 'media', types)).toBe(false);
    for (const permission of ['camera', 'display-capture', 'geolocation', 'microphone', 'notifications', 'clipboard-read'])
      expect(chatGptAudioPermission(url, permission, ['audio'])).toBe(false);
  });
});

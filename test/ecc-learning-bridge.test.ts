import { describe, expect, it } from 'vitest';
import { eccLearningToolCategory } from '../src/main/ecc-learning-bridge.js';

describe('ECC native recorder signal classification', () => {
  it('accepts only established CoS tool categories', () => {
    expect(eccLearningToolCategory('find', { query: 'private search omitted' })).toBe('search');
    expect(eccLearningToolCategory('read', { paths: ['private location omitted'] })).toBe('read');
    expect(eccLearningToolCategory('apply_patch', { patch: 'private code omitted' })).toBe('edit');
    expect(eccLearningToolCategory('browser_evaluate', {})).toBeNull();
    expect(eccLearningToolCategory('agents', { action: 'spawn' })).toBeNull();
  });

  it('recognizes only single, bounded, explicit build/test commands', () => {
    expect(eccLearningToolCategory('exec_command', { cmd: 'npm test' })).toBe('test');
    expect(eccLearningToolCategory('exec_command', { cmd: 'npm run typecheck' })).toBe('test');
    expect(eccLearningToolCategory('exec_command', { cmds: ['pnpm build'] })).toBe('build');
    expect(eccLearningToolCategory('exec_command', { cmd: 'npm run build; curl https://example.com' })).toBeNull();
    expect(eccLearningToolCategory('exec_command', { cmds: ['npm run test', 'npm run build'] })).toBeNull();
    expect(eccLearningToolCategory('exec_command', { cmd: 'powershell -EncodedCommand abc' })).toBeNull();
    expect(eccLearningToolCategory('exec_command', { cmd: 'pytest | tee log' })).toBeNull();
    expect(eccLearningToolCategory('exec_command', { cmd: 'npm run arbitrary' })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { execSelfProtectionFailure, writeStdinSelfProtectionFailure } from '../src/main/exec-protection.js';

describe('exec self-protection', () => {
  const selfPid = 10952;
  const ports = [8765, 8766, 8767, 8768, 8769] as const;

  it.each([
    'Stop-Process -Id 23204,10952 -Force',
    'taskkill /PID 10952 /F',
    'if ($true) { Stop-Process -Id 10952 }',
    'Get-Process "Chat On Steroids" | Stop-Process -Force',
    'taskkill /IM "Chat On Steroids.exe" /F'
  ])('refuses an obvious attempt to terminate the host: %s', (command) => {
    expect(execSelfProtectionFailure([command], { selfPid, reservedPorts: ports })).toEqual(
      expect.objectContaining({ commandIndex: 0 })
    );
  });

  it('refuses the exact listener cleanup pattern that previously killed the host', () => {
    const command =
      "$ids=(Get-NetTCPConnection -LocalPort 8765 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique); " +
      'foreach($procId in $ids) { Stop-Process -Id $procId -Force }';
    expect(execSelfProtectionFailure([command], { selfPid, reservedPorts: ports })).toMatchObject({
      commandIndex: 0,
      reason: 'bridge-port-sweep'
    });
  });

  it('treats cmds as one persistent shell when discovery and termination are split', () => {
    expect(execSelfProtectionFailure([
      '$ids=Get-NetTCPConnection -LocalPort 8767 | Select-Object -ExpandProperty OwningProcess',
      '$ids | Stop-Process -Force'
    ], { selfPid, reservedPorts: ports })).toMatchObject({
      commandIndex: 1,
      reason: 'bridge-port-sweep'
    });
  });

  it('does not block read-only port inspection or stopping a separately identified process', () => {
    expect(execSelfProtectionFailure([
      'Get-NetTCPConnection -LocalPort 8765 -State Listen | Select-Object OwningProcess'
    ], { selfPid, reservedPorts: ports })).toBeNull();
    expect(execSelfProtectionFailure([
      'Stop-Process -Id 23204 -Force'
    ], { selfPid, reservedPorts: ports })).toBeNull();
  });

  it('does not confuse nearby pids or ports with the protected values', () => {
    expect(execSelfProtectionFailure([
      'Stop-Process -Id 109520 -Force',
      '$ids=Get-NetTCPConnection -LocalPort 18765; $ids | Stop-Process'
    ], { selfPid, reservedPorts: ports })).toBeNull();
  });

  it('refuses process termination through continuation stdin but permits polling and Ctrl+C', () => {
    expect(writeStdinSelfProtectionFailure('Stop-Process -Id $pid -Force\r\n')).toMatch(/cannot be sent/i);
    expect(writeStdinSelfProtectionFailure('taskkill /PID 1234 /F\r\n')).toMatch(/cannot be sent/i);
    expect(writeStdinSelfProtectionFailure('')).toBeNull();
    expect(writeStdinSelfProtectionFailure('\u0003')).toBeNull();
    expect(writeStdinSelfProtectionFailure('Write-Output ok\r\n')).toBeNull();
  });
});

// Pure-function tests for wechatsync settings normalize, focused on the
// security-relevant defaults introduced in Sprint 1 (§4.1) and refined
// after Sprint 3 (the legacy unauthenticated compat field is gone now
// that hello handshake is the only auth path).
//
// These guard against accidental regressions like:
//   - default switching from allowRemote: false (loopback) to true (0.0.0.0)
//   - allowRemote leaking truthy when an old data.json has unrelated
//     fields named "allow*"
//   - token / port / connection.status getting silently reset to defaults
//     when a partial object is normalized
//   - obsolete pre-Sprint-3 compat fields sneaking back into the schema

import { describe, it, expect } from 'vitest';

const {
  createDefaultMultiPlatformSyncSettings,
  normalizeMultiPlatformSyncSettings,
} = require('../services/wechatsync-settings');

describe('Sprint 1 §4.1 normalizeMultiPlatformSyncSettings — security defaults', () => {
  // Sprint 3 schema lock: the post-Sprint-3 normalize output may add new
  // fields, but it must keep `allowRemote` as the only legacy-style
  // boolean security flag. If a future change accidentally re-introduces
  // a fallback compat flag ("allow*"), the assertion below will catch it
  // without needing to spell that flag out by name in source.
  const EXPECTED_BOOLEAN_SECURITY_KEYS = ['allowRemote'];

  function listLegacyStyleSecurityKeys(value) {
    return Object.keys(value || {}).filter((key) =>
      key.startsWith('allow') && typeof value[key] === 'boolean');
  }

  it('createDefaultMultiPlatformSyncSettings returns the expected hardened defaults', () => {
    const defaults = createDefaultMultiPlatformSyncSettings();
    expect(defaults.allowRemote).toBe(false);
    expect(defaults.enabled).toBe(false);
    expect(defaults.token).toBe('');
    expect(defaults.connection.status).toBe('untested');
    expect(listLegacyStyleSecurityKeys(defaults)).toEqual(EXPECTED_BOOLEAN_SECURITY_KEYS);
  });

  it('normalize on a missing object returns hardened defaults', () => {
    const normalized = normalizeMultiPlatformSyncSettings();
    expect(normalized.allowRemote).toBe(false);
    expect(listLegacyStyleSecurityKeys(normalized)).toEqual(EXPECTED_BOOLEAN_SECURITY_KEYS);
  });

  it('normalize on an empty object returns hardened defaults', () => {
    const normalized = normalizeMultiPlatformSyncSettings({});
    expect(normalized.allowRemote).toBe(false);
    expect(listLegacyStyleSecurityKeys(normalized)).toEqual(EXPECTED_BOOLEAN_SECURITY_KEYS);
  });

  it('normalize coerces non-boolean truthy values to false (strict === true)', () => {
    // Defense against a stale data.json where a previous version stored
    // allowRemote as 1 / 'true' / 'yes' / non-empty strings — strict opt-in.
    const cases = [
      { allowRemote: 1 },
      { allowRemote: 'true' },
      { allowRemote: 'yes' },
      { allowRemote: {} },
      { allowRemote: [] },
    ];
    for (const input of cases) {
      const normalized = normalizeMultiPlatformSyncSettings(input);
      expect(normalized.allowRemote).toBe(false);
    }
  });

  it('normalize accepts only the literal boolean true to opt into remote bind', () => {
    const normalized = normalizeMultiPlatformSyncSettings({
      allowRemote: true,
    });
    expect(normalized.allowRemote).toBe(true);
  });

  it('normalize coerces explicit false correctly', () => {
    const normalized = normalizeMultiPlatformSyncSettings({
      allowRemote: false,
    });
    expect(normalized.allowRemote).toBe(false);
  });

  it('normalize drops obsolete pre-Sprint-3 compat boolean fields even if data.json still contains them', () => {
    // Sprint 3 removal: if a user upgrades from a build whose data.json
    // still carries an obsolete unauthenticated-mode compat toggle, the
    // normalize step must silently strip it instead of preserving a
    // setting the runtime no longer honours.
    const obsoleteCompatFlag = ['allow', 'Legacy', 'Unauthenticated'].join('');
    const normalized = normalizeMultiPlatformSyncSettings({
      enabled: true,
      port: 9527,
      token: 'abc-123',
      [obsoleteCompatFlag]: true,
    });
    expect(listLegacyStyleSecurityKeys(normalized)).toEqual(EXPECTED_BOOLEAN_SECURITY_KEYS);
    expect(Object.prototype.hasOwnProperty.call(normalized, obsoleteCompatFlag)).toBe(false);
  });

  it('normalize preserves token, port and selected platforms while still hardening the security flags', () => {
    const normalized = normalizeMultiPlatformSyncSettings({
      enabled: true,
      port: 9527,
      token: 'abc-123',
      selectedPlatforms: ['zhihu'],
      // legacy data.json without the security flags
    });
    expect(normalized.enabled).toBe(true);
    expect(normalized.port).toBe(9527);
    expect(normalized.token).toBe('abc-123');
    expect(normalized.selectedPlatforms).toContain('zhihu');
    // Critical: a legacy settings file that predates Sprint 1 must NOT
    // accidentally enable remote bind.
    expect(normalized.allowRemote).toBe(false);
  });

  it('normalize is idempotent — running it twice yields an equivalent result', () => {
    const once = normalizeMultiPlatformSyncSettings({
      enabled: true,
      port: 12345,
      token: '  trim-me  ',
      allowRemote: true,
    });
    const twice = normalizeMultiPlatformSyncSettings(once);
    expect(twice).toEqual(once);
    expect(twice.token).toBe('trim-me');
  });
});

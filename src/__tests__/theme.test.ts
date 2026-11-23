import { describe, it, expect } from 'vitest';
import { readForcedTheme } from '../chat/theme';

describe('readForcedTheme', () => {
  it('returns day for ?embed=1&theme=day', () => {
    expect(readForcedTheme('?embed=1&theme=day')).toBe('day');
  });

  it('returns night for ?embed=1&theme=night', () => {
    expect(readForcedTheme('?embed=1&theme=night')).toBe('night');
  });

  it('returns null when the page is not embedded', () => {
    expect(readForcedTheme('?theme=day')).toBeNull();
  });

  it('returns null for an unknown theme value', () => {
    expect(readForcedTheme('?embed=1&theme=sepia')).toBeNull();
  });

  it('returns null for an empty search string', () => {
    expect(readForcedTheme('')).toBeNull();
  });
});

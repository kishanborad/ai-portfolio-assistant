export type Theme = 'day' | 'night';

/**
 * The embedding page may lock the theme with ?embed=1&theme=day|night.
 * The parameter only applies in embed mode: on the standalone demo the
 * stored choice and the system preference keep working as before.
 * Returns null when there is no forced theme.
 */
export function readForcedTheme(search: string): Theme | null {
  try {
    const params = new URLSearchParams(search);
    if (params.get('embed') !== '1') return null;
    const value = params.get('theme');
    if (value === 'day' || value === 'night') return value;
  } catch {
    // Malformed search string: no forced theme.
  }
  return null;
}

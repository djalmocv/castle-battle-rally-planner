import { describe, it, expect } from 'vitest';
import { escapeCell } from './export';

describe('escapeCell', () => {
  it('wraps plain values in double quotes', () => {
    expect(escapeCell('Alpha')).toBe('"Alpha"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('neutralizes formula-injection prefixes', () => {
    expect(escapeCell('=1+1')).toBe('"\'=1+1"');
    expect(escapeCell('+cmd')).toBe('"\'+cmd"');
    expect(escapeCell('-2')).toBe('"\'-2"');
    expect(escapeCell('@SUM')).toBe('"\'@SUM"');
    expect(escapeCell('\tvalue')).toBe('"\'\tvalue"');
    expect(escapeCell('\rvalue')).toBe('"\'\rvalue"');
  });

  it('leaves safe leading characters untouched', () => {
    expect(escapeCell('Normal name')).toBe('"Normal name"');
    expect(escapeCell('123')).toBe('"123"');
  });

  it('handles empty strings', () => {
    expect(escapeCell('')).toBe('""');
  });
});

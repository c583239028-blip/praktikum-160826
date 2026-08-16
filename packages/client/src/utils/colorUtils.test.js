import { hexToRgba } from './colorUtils';

describe('hexToRgba', () => {
  it('converts a valid hex color to rgba with the given alpha', () => {
    expect(hexToRgba('#1F293B', 0.9)).toBe('rgba(31, 41, 59, 0.9)');
  });

  it('defaults alpha to 1 when not provided', () => {
    expect(hexToRgba('#000000')).toBe('rgba(0, 0, 0, 1)');
  });

  it('clamps alpha above 1 down to 1', () => {
    expect(hexToRgba('#000000', 1.5)).toBe('rgba(0, 0, 0, 1)');
  });

  it('clamps alpha below 0 up to 0', () => {
    expect(hexToRgba('#000000', -0.5)).toBe('rgba(0, 0, 0, 0)');
  });

  it('throws on an invalid hex color', () => {
    expect(() => hexToRgba('#FFF')).toThrow('Invalid hex color: #FFF');
  });
});

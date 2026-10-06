import { describe, expect, test } from 'vitest';
import { lerpColor, colorAt } from '../../src/core/background';

describe('lerpColor', () => {
  test('midpoint', () => expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080'));
  test('clamps above 1', () => expect(lerpColor('#000000', '#ffffff', 2)).toBe('#ffffff'));
  test('clamps below 0', () => expect(lerpColor('#102030', '#ffffff', -1)).toBe('#102030'));
});

describe('colorAt', () => {
  const stops = [
    { at: 0, color: '#000000' },
    { at: 100, color: '#ffffff' },
    { at: 200, color: '#ff0000' },
  ];
  test('before first stop', () => expect(colorAt(stops, -50)).toBe('#000000'));
  test('between stops', () => expect(colorAt(stops, 50)).toBe('#808080'));
  test('after last stop', () => expect(colorAt(stops, 999)).toBe('#ff0000'));
});

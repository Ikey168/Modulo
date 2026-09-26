import { describe, expect, it } from 'vitest';
import { PinchTracker } from '../pinchGesture';

describe('pinch gesture', () => {
  it('reports scale and midpoint movement only while two fingers are down', () => {
    const pinch = new PinchTracker();
    pinch.down(1, 100, 100);
    expect(pinch.move(1, 110, 100)).toBeUndefined();
    pinch.down(2, 210, 100);
    // Spread from 100px to 200px apart: zoom in by 2 around the new midpoint.
    expect(pinch.move(2, 310, 100)).toEqual({ factor: 2, cx: 210, cy: 100, dx: 50, dy: 0 });
    pinch.up(2);
    expect(pinch.count).toBe(1);
    expect(pinch.move(1, 0, 0)).toBeUndefined();
    expect(pinch.move(9, 0, 0)).toBeUndefined();
  });
});

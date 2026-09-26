/**
 * Two-finger pinch and pan for canvas-style views (#492). The views disable
 * browser gestures (`touch-action: none`) so a drag moves nodes instead of the
 * page; this restores zoom on touch, where there is no wheel.
 */
export interface PinchStep {
  /** Scale since the previous step (>1 zooms in). */
  factor: number;
  /** Midpoint between the fingers, in the element's coordinates. */
  cx: number;
  cy: number;
  /** Midpoint movement since the previous step. */
  dx: number;
  dy: number;
}

export class PinchTracker {
  private readonly points = new Map<number, { x: number; y: number }>();

  get count(): number {
    return this.points.size;
  }

  down(id: number, x: number, y: number): void {
    this.points.set(id, { x, y });
  }

  up(id: number): void {
    this.points.delete(id);
  }

  private pair(): [{ x: number; y: number }, { x: number; y: number }] | undefined {
    const [a, b] = [...this.points.values()];
    return a && b ? [a, b] : undefined;
  }

  /** Record a move; returns the pinch step when two fingers are down. */
  move(id: number, x: number, y: number): PinchStep | undefined {
    if (!this.points.has(id)) return undefined;
    const before = this.pair();
    this.points.set(id, { x, y });
    const after = this.pair();
    if (!before || !after) return undefined;
    const distance = ([a, b]: typeof before) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = ([a, b]: typeof before) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const d0 = distance(before);
    const d1 = distance(after);
    const m0 = mid(before);
    const m1 = mid(after);
    return { factor: d0 > 0 ? d1 / d0 : 1, cx: m1.x, cy: m1.y, dx: m1.x - m0.x, dy: m1.y - m0.y };
  }
}

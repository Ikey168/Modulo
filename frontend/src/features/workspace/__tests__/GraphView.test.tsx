import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { TooltipProvider } from '@/ui';
import { GraphView } from '../GraphView';

const d3 = vi.hoisted(() => {
  const nodeSets: Array<Array<{ id: number; x?: number; y?: number; vx?: number; vy?: number }>> = [];
  const simulations: Array<{
    force: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    alpha: ReturnType<typeof vi.fn>;
    restart: ReturnType<typeof vi.fn>;
    alphaTarget: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const forceSimulation = vi.fn((nodes: Array<{ id: number; x?: number; y?: number; vx?: number; vy?: number }>) => {
    const simulation = {
      force: vi.fn(),
      on: vi.fn(),
      alpha: vi.fn(),
      restart: vi.fn(),
      alphaTarget: vi.fn(),
      stop: vi.fn(),
    };
    simulation.force.mockReturnValue(simulation);
    simulation.on.mockReturnValue(simulation);
    simulation.alpha.mockReturnValue(simulation);
    simulation.restart.mockReturnValue(simulation);
    simulation.alphaTarget.mockReturnValue(simulation);
    nodeSets.push(nodes);
    simulations.push(simulation);
    return simulation;
  });
  const chainedForce = () => {
    const force = { id: vi.fn(), distance: vi.fn(), strength: vi.fn(), radius: vi.fn() };
    force.id.mockReturnValue(force);
    force.distance.mockReturnValue(force);
    force.strength.mockReturnValue(force);
    force.radius.mockReturnValue(force);
    return force;
  };
  return { nodeSets, simulations, forceSimulation, chainedForce };
});

vi.mock('d3-force', () => ({
  forceSimulation: d3.forceSimulation,
  forceLink: d3.chainedForce,
  forceManyBody: d3.chainedForce,
  forceCenter: d3.chainedForce,
  forceCollide: d3.chainedForce,
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const note = (title = 'First', content = ''): CoreNote => ({
  id: 1,
  title,
  content,
  tags: [],
});

describe('GraphView layout lifecycle', () => {
  beforeEach(() => {
    d3.simulations.length = 0;
    d3.nodeSets.length = 0;
    d3.forceSimulation.mockClear();
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  });

  it('keeps one simulation across equivalent workspace refreshes', () => {
    const props = {
      selectedId: null,
      onSelectNode: vi.fn(),
      onOpenNote: vi.fn(),
    };
    const view = (notes: CoreNote[]) => (
      <TooltipProvider>
        <GraphView {...props} notes={notes} links={[]} />
      </TooltipProvider>
    );
    const rendered = render(view([note()]));

    rendered.rerender(view([note()]));
    rendered.rerender(view([note('First', 'content changed elsewhere')]));

    expect(d3.forceSimulation).toHaveBeenCalledTimes(1);

    d3.nodeSets[0][0].x = 42;
    d3.nodeSets[0][0].y = -18;
    d3.nodeSets[0][0].vx = 0.5;

    rendered.rerender(view([note('Renamed')]));

    expect(d3.forceSimulation).toHaveBeenCalledTimes(2);
    expect(d3.simulations[0].stop).toHaveBeenCalledTimes(1);
    expect(d3.nodeSets[1][0]).toMatchObject({ x: 42, y: -18, vx: 0.5 });
  });
});

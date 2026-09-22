import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Markdown } from '../Markdown';

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async () => ({ svg: '<svg data-testid="rendered-diagram"></svg>' })),
}));

vi.mock('mermaid', () => ({ default: mermaid }));

describe('Markdown diagrams', () => {
  it('renders Mermaid fences without waiting for a plugin contribution', async () => {
    const { container } = render(
      <Markdown
        content={'```mermaid\nflowchart LR\n  A --> B\n```'}
        notes={[]}
        onSelectNote={() => {}}
        fences={[]}
      />,
    );

    await waitFor(() => expect(mermaid.render).toHaveBeenCalled());
    expect(await screen.findByRole('img', { name: 'Mermaid diagram' })).toBeTruthy();
    expect(container.querySelector('[data-testid="rendered-diagram"]')).toBeTruthy();
    expect(container.querySelector('pre')).toBeNull();
  });

  it('reuses an in-flight Mermaid render when the note remounts during refresh', async () => {
    let finish!: (value: { svg: string }) => void;
    mermaid.render.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const content = '```mermaid\nflowchart LR\n  RefreshA --> RefreshB\n```';
    const props = { content, notes: [], onSelectNote: () => {}, fences: [] };

    const first = render(<Markdown {...props} />);
    await waitFor(() => expect(mermaid.render).toHaveBeenCalled());
    first.unmount();
    render(<Markdown {...props} />);

    expect(mermaid.render).toHaveBeenCalledTimes(2);
    finish({ svg: '<svg data-testid="refresh-safe-diagram"></svg>' });
    expect(await screen.findByRole('img', { name: 'Mermaid diagram' })).toBeTruthy();
    expect(screen.getByTestId('refresh-safe-diagram')).toBeTruthy();
    expect(mermaid.render).toHaveBeenCalledTimes(2);
  });
});

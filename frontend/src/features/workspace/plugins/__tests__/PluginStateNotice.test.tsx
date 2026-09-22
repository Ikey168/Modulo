import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PluginStateNotice } from '../PluginStateNotice';

it('announces synchronization without changing the layout', () => {
  render(
    <PluginStateNotice
      status="syncing"
      retry={vi.fn(async () => {})}
      resolve={vi.fn(async () => {})}
    />,
  );

  const notice = screen.getByRole('status');
  expect(notice).toHaveTextContent('Syncing…');
  expect(notice).toHaveClass('sr-only');
});

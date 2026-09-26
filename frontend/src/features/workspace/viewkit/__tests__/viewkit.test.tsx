import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/ui';
import {
  Choice,
  ChoiceInline,
  ConfirmDelete,
  Fact,
  FactGrid,
  Field,
  FilterChips,
  LinkOut,
  ListRow,
  ListRows,
  Metric,
  RecordCard,
  RecordSheet,
  StatusBadge,
  ViewShell,
  statusVariant,
} from '..';

describe('Field', () => {
  it('associates the label with its control', () => {
    render(
      <Field label="Brand">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Brand')).toBeInTheDocument();
  });

  it('wires hint text via aria-describedby', () => {
    render(
      <Field label="Size" hint="EU sizing">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Size')).toHaveAccessibleDescription('EU sizing');
  });

  it('does not clobber an id the caller set', () => {
    render(
      <Field label="Colour">
        <Input id="explicit" />
      </Field>,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'explicit');
  });
});

describe('ConfirmDelete', () => {
  it('names the record in its accessible name', () => {
    render(<ConfirmDelete itemName="Curse of Strahd" itemLabel="campaign" onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete campaign Curse of Strahd' })).toBeInTheDocument();
  });

  it('does not delete until confirmed', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDelete itemName="Strahd" onDelete={onDelete} consequence="Its sessions go too." />);

    await user.click(screen.getByRole('button', { name: /Delete item Strahd/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/Its sessions go too/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('falls back to a placeholder name when the record is untitled', () => {
    render(<ConfirmDelete itemName="  " itemLabel="outfit" onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete outfit Untitled outfit' })).toBeInTheDocument();
  });
});

describe('statusVariant', () => {
  it('matches whole statuses, not substrings', () => {
    // The previous regex sniffing turned "Invalid" green because it contains "valid".
    expect(statusVariant('Valid')).toBe('success');
    expect(statusVariant('Invalid')).toBe('destructive');
  });

  it('is case-insensitive and falls back to a neutral pill', () => {
    expect(statusVariant('OVERDUE')).toBe('destructive');
    expect(statusVariant('Bespoke domain status')).toBe('outline');
  });

  it('honours explicit overrides', () => {
    expect(statusVariant('Idea', { idea: 'info' })).toBe('info');
  });
});

describe('StatusBadge', () => {
  it('treats a collection-defined completed status as success', () => {
    render(<StatusBadge status="Retired" completedStatuses={['Retired']} />);
    expect(screen.getByText('Retired').className).toContain('text-success');
  });

  it('renders nothing for an empty status', () => {
    const { container } = render(<StatusBadge status="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('LinkOut', () => {
  it('renders a captured url as a real link', () => {
    render(<LinkOut url="https://example.com/datasheet.pdf" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/datasheet.pdf');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('refuses non-http schemes but still shows the text', () => {
    render(<LinkOut url="javascript:alert(1)" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/alert/)).toBeInTheDocument();
  });

  it('renders nothing when there is no url', () => {
    const { container } = render(<LinkOut url={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FilterChips', () => {
  it('exposes pressed state and reports changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChips
        label="Filter tasks"
        value="open"
        onChange={onChange}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done', count: 4 },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Done/ }));
    expect(onChange).toHaveBeenCalledWith('done');
  });
});

describe('ListRow', () => {
  it('activates via a real button with an accessible name', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <ListRows>
        <ListRow title="Rack switch" detail="Online · 48 port" onOpen={onOpen} />
      </ListRows>,
    );
    await user.click(screen.getByRole('button', { name: 'Open Rack switch' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders inert rows without a button', () => {
    render(
      <ListRows>
        <ListRow title="Read only" />
      </ListRows>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Metric', () => {
  it('uses semantic tone tokens rather than a raw palette', () => {
    render(<Metric label="Overdue" value={3} tone="danger" detail="past due" />);
    expect(screen.getByText('3').className).toContain('text-destructive');
    expect(screen.getByText('past due')).toBeInTheDocument();
  });
});

describe('ChoiceInline', () => {
  it('carries an accessible name even with no visible label', () => {
    render(
      <ChoiceInline label="Filter by status" value="Open" onChange={vi.fn()} options={['Open', 'Done']} />,
    );
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
  });
});

describe('Choice', () => {
  it('associates its visible label with the Radix trigger', () => {
    render(<Choice label="Status" value="Open" onChange={vi.fn()} options={['Open', 'Done']} />);
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
  });
});

describe('RecordSheet', () => {
  const record = { id: 'r1', title: 'Rack switch', notes: 'Top of rack' };

  it('shows the read view first and only edits on request', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordSheet
        record={record}
        onClose={vi.fn()}
        title={record.title}
        renderEdit={(draft, setDraft) => (
          <Field label="Notes">
            <Input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </Field>
        )}
        onSave={onSave}
      >
        <FactGrid>
          <Fact label="Notes" value={record.notes} />
        </FactGrid>
      </RecordSheet>,
    );

    expect(screen.getByText('Top of rack')).toBeInTheDocument();
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument();

    const editButton = screen.getByRole('button', { name: 'Edit' });
    await user.click(editButton);
    expect(screen.getByRole('button', { name: 'Save changes' })).not.toBe(editButton);
    const input = screen.getByLabelText('Notes');
    await user.clear(input);
    await user.type(input, 'Moved to shelf 2');
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith({ ...record, notes: 'Moved to shelf 2' });
  });

  it('discards the draft on cancel', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordSheet
        record={record}
        onClose={vi.fn()}
        title={record.title}
        renderEdit={(draft, setDraft) => (
          <Field label="Notes">
            <Input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </Field>
        )}
        onSave={onSave}
      >
        <Fact label="Notes" value={record.notes} />
      </RecordSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Notes'), ' edited');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Top of rack')).toBeInTheDocument();
  });

  it('offers no edit affordance when the screen supplies no editor', () => {
    render(
      <RecordSheet record={record} onClose={vi.fn()} title={record.title}>
        <Fact label="Notes" value={record.notes} />
      </RecordSheet>,
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('renders nothing when there is no open record', () => {
    render(
      <RecordSheet record={null} onClose={vi.fn()} title="">
        <Fact label="Notes" value="hidden" />
      </RecordSheet>,
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });
});

describe('Fact', () => {
  it('marks an unset value rather than rendering a blank', () => {
    render(<Fact label="Safety tools" value="" placeholder="None recorded" />);
    expect(screen.getByText('None recorded')).toBeInTheDocument();
  });

  it('treats an empty array as unset', () => {
    render(<Fact label="Players" value={[]} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });
});

describe('RecordCard', () => {
  it('keeps row actions outside the activating button', async () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <RecordCard
        title="Curse of Strahd"
        onOpen={onOpen}
        actions={<ConfirmDelete itemName="Curse of Strahd" itemLabel="campaign" onDelete={onDelete} />}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete campaign Curse of Strahd' }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('ViewShell', () => {
  it('shows the subtitle to sighted readers, not only to screen readers', () => {
    // It was briefly `sr-only`, which silently hid the one-line description on
    // every migrated screen.
    render(
      <ViewShell title="Wardrobe" subtitle="Garments, seasons, fit and storage.">
        <p>body</p>
      </ViewShell>,
    );
    const subtitle = screen.getByText('Garments, seasons, fit and storage.');
    expect(subtitle).toBeVisible();
    expect(subtitle.className).not.toContain('sr-only');
  });

  it('renders the title as the view heading', () => {
    render(
      <ViewShell title="Wardrobe">
        <p>body</p>
      </ViewShell>,
    );
    expect(screen.getByRole('heading', { name: 'Wardrobe' })).toBeInTheDocument();
  });
});

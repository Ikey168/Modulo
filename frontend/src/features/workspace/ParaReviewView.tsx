import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, History, RefreshCw } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Label, Textarea } from '@/ui';
import {
  ConfirmDelete,
  EmptyPanel,
  Fact,
  FactGrid,
  Field,
  FieldGroup,
  HealthLine,
  HealthList,
  ListRow,
  ListRows,
  Panel,
  RecordSheet,
  SearchInput,
  Toolbar,
  ViewShell,
} from './viewkit';
import { REVIEW_CHECKLIST, isoDay, newParaId, reviewSignals, type ParaReview } from './para';
import { useParaStore } from './useParaStore';

const emptyChecklist = () => REVIEW_CHECKLIST.map(() => false);

const doneCount = (checklist: boolean[]) => checklist.filter(Boolean).length;

/** The reset checklist, as a labelled checkbox group rather than bare boxes. */
function ChecklistFields({
  checklist,
  onChange,
  idPrefix,
}: {
  checklist: boolean[];
  onChange: (next: boolean[]) => void;
  idPrefix: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {REVIEW_CHECKLIST.map((item, index) => {
        const id = `${idPrefix}-${index}`;
        return (
          <li key={item} className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={checklist[index] === true}
              onCheckedChange={(checked) =>
                onChange(checklist.map((value, position) => (position === index ? checked === true : value)))
              }
            />
            <Label htmlFor={id} className="text-xs font-normal leading-5">
              {item}
            </Label>
          </li>
        );
      })}
    </ul>
  );
}

/** Review fields shared by the compose panel and the edit sheet. */
function ReviewFields({
  draft,
  setDraft,
  idPrefix,
}: {
  draft: ParaReview;
  setDraft: (next: ParaReview) => void;
  idPrefix: string;
}) {
  return (
    <>
      <FieldGroup legend="Reset checklist" columns={1}>
        <ChecklistFields
          checklist={draft.checklist}
          onChange={(checklist) => setDraft({ ...draft, checklist })}
          idPrefix={idPrefix}
        />
      </FieldGroup>
      <FieldGroup legend="Log" columns={1}>
        <Field label="Date">
          <Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </Field>
        <Field label="Wins" hint="What actually moved, and why it worked.">
          <Textarea rows={3} value={draft.wins} onChange={(event) => setDraft({ ...draft, wins: event.target.value })} />
        </Field>
        <Field label="Friction" hint="Where the system fought you this period.">
          <Textarea
            rows={3}
            value={draft.friction}
            onChange={(event) => setDraft({ ...draft, friction: event.target.value })}
          />
        </Field>
        <Field label="Next focus" hint="The one thing the next period is for.">
          <Textarea
            rows={3}
            value={draft.nextFocus}
            onChange={(event) => setDraft({ ...draft, nextFocus: event.target.value })}
          />
        </Field>
      </FieldGroup>
    </>
  );
}

export function ParaReviewView() {
  const [data, persist] = useParaStore();
  const [draft, setDraft] = useState<ParaReview>(() => ({
    id: newParaId('review'),
    date: isoDay(),
    wins: '',
    friction: '',
    nextFocus: '',
    checklist: emptyChecklist(),
    signals: [],
  }));
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const signals = reviewSignals(data);
  const canComplete =
    [draft.wins, draft.friction, draft.nextFocus].some((value) => value.trim()) || draft.checklist.some(Boolean);

  const complete = () => {
    if (!canComplete) return;
    persist((current) => ({
      ...current,
      reviews: [
        {
          ...draft,
          wins: draft.wins.trim(),
          friction: draft.friction.trim(),
          nextFocus: draft.nextFocus.trim(),
          signals: reviewSignals(current),
        },
        ...current.reviews,
      ],
    }));
    setDraft({
      id: newParaId('review'),
      date: isoDay(),
      wins: '',
      friction: '',
      nextFocus: '',
      checklist: emptyChecklist(),
      signals: [],
    });
  };

  const save = (next: ParaReview) =>
    persist((current) => ({
      ...current,
      reviews: current.reviews.map((review) => (review.id === next.id ? next : review)),
    }));

  const remove = (id: string) =>
    persist((current) => ({ ...current, reviews: current.reviews.filter((review) => review.id !== id) }));

  const history = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.reviews.filter(
      (review) =>
        !needle ||
        `${review.date} ${review.wins} ${review.friction} ${review.nextFocus}`.toLowerCase().includes(needle),
    );
  }, [data.reviews, query]);

  const open = data.reviews.find((review) => review.id === openId) ?? null;

  return (
    <ViewShell
      title="PARA Review Engine"
      icon={RefreshCw}
      subtitle="Maintenance keeps the system trustworthy."
      toolbar={
        <Toolbar>
          <SearchInput value={query} onChange={setQuery} placeholder="Search past reviews…" label="Search past reviews" />
        </Toolbar>
      }
      bodyClassName="grid gap-4 p-4 lg:grid-cols-2"
    >
      <div className="min-w-0 space-y-4">
        <Panel title="Current signals" icon={CheckCircle2} description="Structural warnings computed from your PARA data.">
          <HealthList>
            {signals.length === 0 ? (
              <HealthLine okay>No structural warnings.</HealthLine>
            ) : (
              signals.map((signal) => (
                <HealthLine key={signal} okay={false}>
                  {signal}
                </HealthLine>
              ))
            )}
          </HealthList>
        </Panel>

        <Panel
          title="Run a review"
          icon={ClipboardCheck}
          description={`${doneCount(draft.checklist)} of ${REVIEW_CHECKLIST.length} reset items ticked.`}
        >
          <div className="grid gap-3">
            <ReviewFields draft={draft} setDraft={setDraft} idPrefix="review-new" />
            <div>
              <Button size="sm" onClick={complete} disabled={!canComplete}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Complete review
              </Button>
              {!canComplete && (
                <p className="mt-1.5 text-xxs text-muted-foreground">
                  Tick at least one reset item, or write a win, friction, or next focus.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="History" icon={History} description="Completed reviews, as a decision log." bodyClassName="p-0">
        {history.length === 0 ? (
          <EmptyPanel
            icon={History}
            title={data.reviews.length === 0 ? 'No reviews yet' : 'Nothing matches'}
            description={
              data.reviews.length === 0
                ? 'Completed reviews become a decision log here.'
                : 'Try another search term.'
            }
          />
        ) : (
          <ListRows>
            {history.map((review) => (
              <ListRow
                key={review.id}
                title={review.nextFocus || 'No next focus recorded'}
                detail={`${review.date} · ${doneCount(review.checklist)}/${REVIEW_CHECKLIST.length} reset items`}
                openLabel={`Open review from ${review.date}`}
                onOpen={() => setOpenId(review.id)}
                meta={<Badge variant="secondary">{review.date}</Badge>}
                actions={
                  <ConfirmDelete
                    itemName={`Review ${review.date}`}
                    itemLabel="review"
                    onDelete={() => remove(review.id)}
                    consequence="Its wins, friction, next focus, reset-checklist state and the signal snapshot taken at the time are removed from the log. Projects, areas, resources and tasks are untouched."
                  />
                }
              />
            ))}
          </ListRows>
        )}
      </Panel>

      <RecordSheet
        record={open}
        onClose={() => setOpenId(null)}
        title={open ? `Review ${open.date}` : ''}
        subtitle={open ? `${doneCount(open.checklist)} of ${REVIEW_CHECKLIST.length} reset items completed` : undefined}
        renderEdit={(current, setCurrent) => (
          <ReviewFields draft={current} setDraft={setCurrent} idPrefix={`review-edit-${current.id}`} />
        )}
        onSave={save}
        actions={
          open && (
            <ConfirmDelete
              itemName={`Review ${open.date}`}
              itemLabel="review"
              onDelete={() => {
                remove(open.id);
                setOpenId(null);
              }}
              consequence="Its wins, friction, next focus, reset-checklist state and the signal snapshot taken at the time are removed from the log. Projects, areas, resources and tasks are untouched."
            />
          )
        }
      >
        {open && (
          <FactGrid>
            <Fact label="Next focus" value={open.nextFocus} wide emphasis placeholder="No next focus recorded" />
            <Fact label="Wins" value={open.wins} wide placeholder="No wins recorded" />
            <Fact label="Friction" value={open.friction} wide placeholder="No friction recorded" />
            <Fact
              label="Reset checklist"
              wide
              value={
                doneCount(open.checklist) === 0 ? undefined : (
                  <ul className="space-y-0.5">
                    {REVIEW_CHECKLIST.filter((_, index) => open.checklist[index]).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )
              }
              placeholder="No reset items were ticked"
            />
            <Fact
              label="Signals at the time"
              wide
              value={
                open.signals.length === 0 ? undefined : (
                  <ul className="space-y-0.5">
                    {open.signals.map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                )
              }
              placeholder="No structural warnings were open"
            />
          </FactGrid>
        )}
      </RecordSheet>
    </ViewShell>
  );
}

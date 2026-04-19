import { useState } from 'react';
import { formatDate } from '../../../lib/formatting';
import { GrievanceStatusBadge } from '../../../components/shared/GrievanceStatusBadge';
import { grievanceTags, type Grievance } from '../../../types/api';
import { useUserRole } from '../../../stores/authStore';
import {
  useUpdateGrievanceStatus,
  useDeleteGrievance,
  useAddGrievanceTag,
  useRemoveGrievanceTag,
} from '../../../hooks/useGrievances';
import { useToast } from '../../../stores/uiStore';

interface GrievanceCardProps {
  grievance: Grievance;
}

const CATEGORY_LABEL: Record<string, string> = {
  commission_change: 'Commission Change',
  deactivation:      'Deactivation',
  payment_delay:     'Payment Delay',
  unfair_rating:     'Unfair Rating',
  safety:            'Safety',
  other:             'Other',
};

const STATUS_OPTIONS: Grievance['status'][] = ['open', 'escalated', 'resolved'];

export function GrievanceCard({ grievance: g }: GrievanceCardProps) {
  const tags = grievanceTags(g);
  const role = useUserRole();
  const { toast } = useToast();
  const [tagDraft, setTagDraft] = useState('');

  const updateStatus = useUpdateGrievanceStatus();
  const deleteG    = useDeleteGrievance();
  const addTag       = useAddGrievanceTag();
  const removeTag    = useRemoveGrievanceTag();

  const isAdvocate = role === 'advocate';

  return (
    <article className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-widest uppercase text-amber">
              {CATEGORY_LABEL[g.category] ?? g.category}
            </span>
            {g.platform_name && (
              <span className="font-mono text-[10px] text-t3">— {g.platform_name}</span>
            )}
          </div>
          <p className="font-sans text-sm text-t1 line-clamp-3">{g.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isAdvocate ? (
            <select
              value={g.status}
              disabled={updateStatus.isPending}
              onChange={(e) => {
                const next = e.target.value as Grievance['status'];
                updateStatus.mutate(
                  { id: g.id, payload: { status: next } },
                  {
                    onSuccess: () => toast('Status updated', 'success'),
                    onError: () => toast('Could not update status', 'error'),
                  },
                );
              }}
              className="fg-select-compatible font-mono text-[9px] uppercase tracking-wide bg-elevated border border-border rounded px-2 py-1 text-t1"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <GrievanceStatusBadge status={g.status} />
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 font-mono text-[9px] tracking-wide px-2 py-0.5 rounded-full bg-elevated text-t3"
            >
              {tag}
              {isAdvocate && (
                <button
                  type="button"
                  disabled={removeTag.isPending}
                  onClick={() =>
                    removeTag.mutate(
                      { id: g.id, tag },
                      {
                        onError: () => toast('Could not remove tag', 'error'),
                      },
                    )
                  }
                  className="text-t4 hover:text-rust"
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {isAdvocate && (
        <div className="flex flex-wrap gap-2 items-center border-t border-border pt-3">
          <input
            type="text"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="Add tag…"
            className="flex-1 min-w-[120px] bg-elevated border border-border rounded px-2 py-1 font-mono text-[10px] text-t1"
          />
          <button
            type="button"
            disabled={!tagDraft.trim() || addTag.isPending}
            onClick={() => {
              const t = tagDraft.trim();
              if (!t) return;
              addTag.mutate(
                { id: g.id, tag: t },
                {
                  onSuccess: () => {
                    setTagDraft('');
                    toast('Tag added', 'success');
                  },
                  onError: () => toast('Could not add tag', 'error'),
                },
              );
            }}
            className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 border border-amber text-amber rounded hover:bg-amber-bg disabled:opacity-40"
          >
            Add tag
          </button>
          <button
            type="button"
            disabled={deleteG.isPending}
            onClick={() => {
              if (!window.confirm('Delete this grievance permanently?')) return;
              deleteG.mutate(g.id, {
                onSuccess: () => toast('Grievance deleted', 'success'),
                onError: () => toast('Could not delete', 'error'),
              });
            }}
            className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 border border-border text-rust rounded hover:bg-elevated ml-auto"
          >
            Delete
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-t3">
        <span className="font-sans text-xs">
          {g.is_anonymous ? 'Anonymous' : (g.worker_name ?? 'Unknown')}
        </span>
        <span className="font-mono text-[10px]">{formatDate(g.created_at)}</span>
      </div>
    </article>
  );
}

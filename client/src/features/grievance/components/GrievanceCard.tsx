import { formatDate } from '../../../lib/formatting';
import { GrievanceStatusBadge } from '../../../components/shared/GrievanceStatusBadge';
import { grievanceTags, type Grievance } from '../../../types/api';

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

export function GrievanceCard({ grievance: g }: GrievanceCardProps) {
  const tags = grievanceTags(g);
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
          <GrievanceStatusBadge status={g.status} />
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="font-mono text-[9px] tracking-wide px-2 py-0.5 rounded-full bg-elevated text-t3">
              {tag}
            </span>
          ))}
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

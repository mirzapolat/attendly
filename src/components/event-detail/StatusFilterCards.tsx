import type { CSSProperties, MouseEvent } from 'react';
import { AlertTriangle, CheckCircle, UserMinus, Users } from 'lucide-react';
import AnimatedCount from '@/components/AnimatedCount';
import { Card, CardContent } from '@/components/ui/card';

export type StatusFilterKey = 'all' | 'verified' | 'suspicious' | 'excused';

interface StatusFilterCardsProps {
  total: number;
  excusedCount: number;
  verifiedCount: number;
  suspiciousCount: number;
  statusFilter: StatusFilterKey;
  onSelect: (filter: StatusFilterKey, event: MouseEvent<HTMLElement>) => void;
  cloudBurstIds: Record<StatusFilterKey, number | null>;
  styleByFilter: Record<StatusFilterKey, CSSProperties | undefined>;
  bubbleClassByFilter: Record<StatusFilterKey, string>;
}

const StatusFilterCards = ({
  total,
  excusedCount,
  verifiedCount,
  suspiciousCount,
  statusFilter,
  onSelect,
  cloudBurstIds,
  styleByFilter,
  bubbleClassByFilter,
}: StatusFilterCardsProps) => (
  <div className="grid grid-cols-2 min-[560px]:grid-cols-4 gap-4 mt-4">
    <Card
      className={`bg-gradient-card relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--primary)/0.45)] filter-cloudy-primary ${statusFilter === 'all' ? 'ring-2 ring-primary filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--primary)/0.45)]' : ''}`}
      onClick={(event) => onSelect('all', event)}
      style={styleByFilter.all}
    >
      {cloudBurstIds.all ? (
        <span key={cloudBurstIds.all} className="filter-cloud-burst" />
      ) : null}
      <CardContent className={`py-4 text-center relative z-10 ${bubbleClassByFilter.all}`}>
        <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
        <p className="text-2xl font-bold"><AnimatedCount value={total} /></p>
        <p className="text-xs text-muted-foreground">Total</p>
      </CardContent>
    </Card>
    <Card
      className={`bg-gradient-card relative overflow-hidden transition-all ${excusedCount === 0 ? 'opacity-50 cursor-default pointer-events-none' : `cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--warning)/0.45)] filter-cloudy-warning ${statusFilter === 'excused' ? 'ring-2 ring-warning filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--warning)/0.45)]' : ''}`}`}
      onClick={(event) => onSelect('excused', event)}
      style={styleByFilter.excused}
    >
      {cloudBurstIds.excused ? (
        <span key={cloudBurstIds.excused} className="filter-cloud-burst" />
      ) : null}
      <CardContent className={`py-4 text-center relative z-10 ${bubbleClassByFilter.excused}`}>
        <UserMinus className="w-5 h-5 mx-auto mb-1 text-warning" />
        <p className="text-2xl font-bold"><AnimatedCount value={excusedCount} /></p>
        <p className="text-xs text-muted-foreground">Excused</p>
      </CardContent>
    </Card>
    <Card
      className={`bg-gradient-card relative overflow-hidden transition-all ${verifiedCount === 0 ? 'opacity-50 cursor-default pointer-events-none' : `cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--success)/0.45)] filter-cloudy-success ${statusFilter === 'verified' ? 'ring-2 ring-success filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--success)/0.45)]' : ''}`}`}
      onClick={(event) => onSelect('verified', event)}
      style={styleByFilter.verified}
    >
      {cloudBurstIds.verified ? (
        <span key={cloudBurstIds.verified} className="filter-cloud-burst" />
      ) : null}
      <CardContent className={`py-4 text-center relative z-10 ${bubbleClassByFilter.verified}`}>
        <CheckCircle className="w-5 h-5 mx-auto mb-1 text-success" />
        <p className="text-2xl font-bold"><AnimatedCount value={verifiedCount} /></p>
        <p className="text-xs text-muted-foreground">Checked-in</p>
      </CardContent>
    </Card>
    <Card
      className={`bg-gradient-card relative overflow-hidden transition-all ${suspiciousCount === 0 ? 'opacity-50 cursor-default pointer-events-none' : `cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_hsl(var(--destructive)/0.45)] filter-cloudy-destructive ${statusFilter === 'suspicious' ? 'ring-2 ring-destructive filter-cloudy -translate-y-0.5 !shadow-[0_12px_24px_-14px_hsl(var(--destructive)/0.45)]' : ''}`}`}
      onClick={(event) => onSelect('suspicious', event)}
      style={styleByFilter.suspicious}
    >
      {cloudBurstIds.suspicious ? (
        <span key={cloudBurstIds.suspicious} className="filter-cloud-burst" />
      ) : null}
      <CardContent className={`py-4 text-center relative z-10 ${bubbleClassByFilter.suspicious}`}>
        <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-destructive" />
        <p className="text-2xl font-bold"><AnimatedCount value={suspiciousCount} /></p>
        <p className="text-xs text-muted-foreground">Suspicious</p>
      </CardContent>
    </Card>
  </div>
);

export default StatusFilterCards;

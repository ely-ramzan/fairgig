import { StatusPill } from '../../../components/shared/StatusPill';
import { ScreenshotUploadButton } from './ScreenshotUploadButton';
import { MonoValue } from '../../../components/shared/MonoValue';
import { formatPKR, formatDate, formatHours } from '../../../lib/formatting';
import type { Shift } from '../../../types/api';

interface ShiftRowProps {
  shift: Shift;
}

export function ShiftRow({ shift }: ShiftRowProps) {
  const commRate =
    shift.gross_earned > 0
      ? ((shift.platform_deductions / shift.gross_earned) * 100).toFixed(1)
      : '0.0';

  return (
    <tr className="border-b border-border hover:bg-elevated/40 transition-colors">
      <td className="py-3 px-4 font-sans text-sm text-t2">{formatDate(shift.shift_date)}</td>
      <td className="py-3 px-4 font-sans text-sm text-t1">{shift.platform_name ?? '—'}</td>
      <td className="py-3 px-4 text-right">
        <MonoValue size="sm" muted>
          {formatHours(shift.hours_worked)}
        </MonoValue>
      </td>
      <td className="py-3 px-4 text-right">
        <MonoValue size="sm">{formatPKR(shift.net_received)}</MonoValue>
      </td>
      <td className="py-3 px-4 text-right">
        <MonoValue size="sm" muted>
          {commRate}%
        </MonoValue>
      </td>
      <td className="py-3 px-4">
        <StatusPill status={shift.verification_status} />
      </td>
      <td className="py-3 px-4 text-right">
        <ScreenshotUploadButton shiftId={shift.id} hasScreenshot={shift.has_screenshot} />
      </td>
    </tr>
  );
}

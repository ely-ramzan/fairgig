import { ShiftRow } from './ShiftRow';
import type { Shift } from '../../../types/api';

interface ShiftTableProps {
  shifts: Shift[];
}

const HEADERS = ['Date', 'Platform', 'Hours', 'Net', 'Commission', 'Status', 'Shot'];

export function ShiftTable({ shifts }: ShiftTableProps) {
  if (shifts.length === 0) {
    return (
      <div className="text-center py-12 font-mono text-[10px] tracking-widest uppercase text-t4">
        No shifts logged yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {HEADERS.map((h) => (
              <th
                key={h}
                className={`py-2 px-4 font-mono text-[9px] tracking-widest uppercase text-t3 ${
                  ['Hours', 'Net', 'Commission'].includes(h) ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => (
            <ShiftRow key={s.id} shift={s} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

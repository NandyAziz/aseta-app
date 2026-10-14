'use client';

import { GREET_TAP_TARGET } from '@/utils/aseta';

/**
 * A single daily mission row with a checkbox & XP claim button.
 * Purely derived from props → safe from hydration mismatch.
 */
function QuestRow({
  emoji,
  title,
  xp,
  done,
  claimed,
  onClaim,
}: {
  emoji: string;
  title: string;
  xp: number;
  done: boolean;
  claimed: boolean;
  onClaim: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-ivory/70 p-3">
      <span className="text-lg leading-none" aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-forest wrap-break-word">{title}</p>
        <p className="text-[11px] font-semibold text-brand">+{xp} XP</p>
      </div>
      {claimed ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-brand ring-1 ring-inset ring-emerald-200">
          ✓ Diklaim
        </span>
      ) : (
        <button
          type="button"
          onClick={onClaim}
          disabled={!done}
          className="min-h-11 shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 active:scale-95 hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted sm:min-h-0"
        >
          Klaim XP
        </button>
      )}
    </li>
  );
}

/**
 * "Misi Hari Ini" card — three daily missions + XP claims.
 *
 * All mission state is already derived in the page (guarded by `isMounted`),
 * so this component is pure presentation + `onClaim` action forwarding.
 */
export default function DailyMissions({
  qrisDone,
  qrisClaimed,
  depositDone,
  depositClaimed,
  greetDone,
  greetClaimed,
  greetTapsUsed,
  onClaim,
  className = '',
}: {
  qrisDone: boolean;
  qrisClaimed: boolean;
  depositDone: boolean;
  depositClaimed: boolean;
  greetDone: boolean;
  greetClaimed: boolean;
  greetTapsUsed: number;
  onClaim: (kind: 'qris' | 'deposit' | 'greet') => void;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-line bg-white p-4 sm:p-5 ${className}`}
    >
      <div className="mb-3">
        <h2 className="text-base font-bold text-forest">Misi Hari Ini</h2>
        <p className="text-xs text-muted">Selesaikan misi, klaim XP untuk maskotmu</p>
      </div>
      <ul className="space-y-2">
        <QuestRow
          emoji="☕"
          title="Lakukan 1x Pembulatan QRIS"
          xp={100}
          done={qrisDone}
          claimed={qrisClaimed}
          onClaim={() => onClaim('qris')}
        />
        <QuestRow
          emoji="🪙"
          title="Tabung minimal Rp5.000 hari ini"
          xp={200}
          done={depositDone}
          claimed={depositClaimed}
          onClaim={() => onClaim('deposit')}
        />
        <QuestRow
          emoji="🐉"
          title={`Sapa Aseta (Tap Maskot ${greetTapsUsed}/${GREET_TAP_TARGET})`}
          xp={50}
          done={greetDone}
          claimed={greetClaimed}
          onClaim={() => onClaim('greet')}
        />
      </ul>
    </section>
  );
}
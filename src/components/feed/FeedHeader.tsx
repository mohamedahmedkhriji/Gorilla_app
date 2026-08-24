import { RefreshCcw } from 'lucide-react';

type FeedHeaderProps = {
  onRefresh: () => void;
  onCreate: () => void;
  title: string;
  subtitle: string;
  composerPlaceholder: string;
  postLabel: string;
  avatarUrl: string;
  avatarAlt: string;
  refreshAria: string;
  refreshLabel: string;
  refreshingLabel: string;
  refreshing: boolean;
};

export default function FeedHeader({
  onRefresh,
  onCreate,
  title,
  subtitle,
  composerPlaceholder,
  postLabel,
  avatarUrl,
  avatarAlt,
  refreshAria,
  refreshLabel,
  refreshingLabel,
  refreshing,
}: FeedHeaderProps) {
  return (
    <section data-coachmark-target="blogs_page_intro" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-text-primary">{title}</h1>
          <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-xs font-semibold text-text-secondary transition-all duration-200 hover:border-accent/35 hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={refreshAria}
        >
          <RefreshCcw size={16} className={refreshing ? 'animate-spin text-accent' : ''} aria-hidden="true" />
          <span>{refreshing ? refreshingLabel : refreshLabel}</span>
        </button>
      </div>

      <div
        data-coachmark-target="blogs_create_button"
        className="flex min-h-[58px] items-center gap-2.5 rounded-2xl border border-white/10 bg-[#111b2a]/85 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <button type="button" onClick={onCreate} className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <img src={avatarUrl} alt={avatarAlt} className="h-10 w-10 rounded-full border border-white/10 object-cover" />
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="min-h-10 min-w-0 flex-1 truncate rounded-xl px-1 text-left text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {composerPlaceholder}
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="min-h-10 shrink-0 rounded-full border border-accent/70 px-3.5 text-xs font-bold text-accent transition-all duration-200 hover:bg-accent hover:text-black active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {postLabel}
        </button>
      </div>
    </section>
  );
}

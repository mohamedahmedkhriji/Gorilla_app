type FeedHeaderProps = {
  onCreate: () => void;
  title: string;
  subtitle: string;
  composerPlaceholder: string;
  postLabel: string;
  avatarUrl: string;
  avatarAlt: string;
};

export default function FeedHeader({
  onCreate,
  title,
  subtitle,
  composerPlaceholder,
  postLabel,
  avatarUrl,
  avatarAlt,
}: FeedHeaderProps) {
  return (
    <section data-coachmark-target="blogs_page_intro" className="space-y-4">
      <div className="text-center">
        <div className="mx-auto">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-text-primary">{title}</h1>
          <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
        </div>
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

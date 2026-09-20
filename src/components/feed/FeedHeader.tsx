type FeedHeaderProps = {
  onCreate: () => void;
  title: string;
  subtitle: string;
  composerPlaceholder: string;
  postLabel: string;
  avatarUrl: string;
  avatarAlt: string;
  themeVariant?: 'default' | 'girls';
};

export default function FeedHeader({
  onCreate,
  title,
  subtitle,
  composerPlaceholder,
  postLabel,
  avatarUrl,
  avatarAlt,
  themeVariant = 'default',
}: FeedHeaderProps) {
  const isGirlsTheme = themeVariant === 'girls';
  return (
    <section data-coachmark-target="blogs_page_intro" className="space-y-4">
      <div className="text-center">
        <div className="mx-auto">
          <h1 className={`text-2xl font-bold tracking-[-0.02em] ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-text-primary'}`}>{title}</h1>
          <p className={`mt-0.5 text-xs ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>{subtitle}</p>
        </div>
      </div>

      <div
        data-coachmark-target="blogs_create_button"
        className={`flex min-h-[58px] items-center gap-2.5 rounded-2xl border p-2.5 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 shadow-[0_12px_28px_rgba(226,180,189,0.12)]' : 'border-white/10 bg-[#111b2a]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'}`}
      >
        <button type="button" onClick={onCreate} className={`shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isGirlsTheme ? 'focus-visible:outline-[#F9B2D7]' : 'focus-visible:outline-accent'}`}>
          <img src={avatarUrl} alt={avatarAlt} className={`h-10 w-10 rounded-full border object-cover ${isGirlsTheme ? 'border-[#E2B4BD]/45' : 'border-white/10'}`} />
        </button>
        <button
          type="button"
          onClick={onCreate}
          className={`min-h-10 min-w-0 flex-1 truncate rounded-xl px-1 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${isGirlsTheme ? 'text-[#795E67] hover:text-[#4A4A4A] focus-visible:ring-[#F9B2D7]/70' : 'text-text-secondary hover:text-text-primary focus-visible:ring-accent'}`}
        >
          {composerPlaceholder}
        </button>
        <button
          type="button"
          onClick={onCreate}
          className={`min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-bold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${isGirlsTheme ? 'border-[#F9B2D7]/70 bg-[#F9B2D7]/18 text-[#795E67] hover:bg-[#F9B2D7] hover:text-[#4A4A4A] focus-visible:ring-[#F9B2D7]/70' : 'border-accent/70 text-accent hover:bg-accent hover:text-black focus-visible:ring-accent'}`}
        >
          {postLabel}
        </button>
      </div>
    </section>
  );
}

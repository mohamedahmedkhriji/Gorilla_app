import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { emojiAutoNutrition, emojiMyNutrition, emojiShop } from '../services/emojiTheme';
import { BooksLibrary } from './BooksLibrary';

interface ShopProps {
  onBack: () => void;
}

const shopFilters = ['Creatine', 'Protein', 'Pre-workout', 'Books'] as const;
type ShopFilter = (typeof shopFilters)[number];
type SupplementFilter = Exclude<ShopFilter, 'Books'>;

type ShopProduct = {
  id: string;
  title: string;
  price: number;
  detail: string;
  image: string;
  tone: string;
};

const productsByFilter: Record<SupplementFilter, ShopProduct[]> = {
  Creatine: [
    { id: 'creatine-core', title: 'Creatine Core', price: 24, detail: 'Daily strength support', image: emojiAutoNutrition, tone: 'from-accent/35 to-white/10' },
    { id: 'creatine-micronized', title: 'Micronized Creatine', price: 29, detail: 'Smooth mixing formula', image: emojiShop, tone: 'from-sky-400/30 to-accent/12' },
    { id: 'creatine-stack', title: 'Power Stack', price: 39, detail: 'Built for overload phases', image: emojiMyNutrition, tone: 'from-amber-300/30 to-accent/12' },
    { id: 'creatine-caps', title: 'Creatine Caps', price: 19, detail: 'No-scoop convenience', image: emojiAutoNutrition, tone: 'from-emerald-300/30 to-white/10' },
  ],
  Protein: [
    { id: 'protein-whey', title: 'Whey Protein', price: 42, detail: 'Post-workout recovery', image: emojiMyNutrition, tone: 'from-accent/30 to-rose-300/15' },
    { id: 'protein-isolate', title: 'Lean Isolate', price: 49, detail: 'Low sugar, high protein', image: emojiAutoNutrition, tone: 'from-cyan-300/30 to-white/10' },
    { id: 'protein-vegan', title: 'Plant Protein', price: 38, detail: 'Clean daily nutrition', image: emojiShop, tone: 'from-green-300/30 to-accent/10' },
    { id: 'protein-mass', title: 'Mass Builder', price: 55, detail: 'Extra calories for bulk', image: emojiMyNutrition, tone: 'from-orange-300/30 to-white/10' },
  ],
  'Pre-workout': [
    { id: 'pre-focus', title: 'Focus Pre', price: 34, detail: 'Clean energy blend', image: emojiShop, tone: 'from-accent/35 to-cyan-300/12' },
    { id: 'pre-pump', title: 'Pump Formula', price: 36, detail: 'Hard session support', image: emojiAutoNutrition, tone: 'from-fuchsia-300/25 to-accent/12' },
    { id: 'pre-caffeine', title: 'Caffeine Kick', price: 28, detail: 'Fast training energy', image: emojiMyNutrition, tone: 'from-yellow-300/30 to-white/10' },
    { id: 'pre-night', title: 'Stim-Free Pump', price: 32, detail: 'Late workout friendly', image: emojiShop, tone: 'from-violet-300/25 to-accent/12' },
  ],
};

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girl' || normalized === 'girls' || normalized === 'femme';
};

const readStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

export function Shop({ onBack }: ShopProps) {
  const [activeFilter, setActiveFilter] = useState<ShopFilter>('Creatine');
  const [styleGender, setStyleGender] = useState(() => readStyleGender());
  const activeProducts = activeFilter === 'Books' ? [] : productsByFilter[activeFilter];
  const isGirlsTheme = isGirlsStyleValue(styleGender);

  useEffect(() => {
    const refreshStyleGender = () => setStyleGender(readStyleGender());

    window.addEventListener('repset:app-style-gender-changed', refreshStyleGender);
    window.addEventListener('storage', refreshStyleGender);

    return () => {
      window.removeEventListener('repset:app-style-gender-changed', refreshStyleGender);
      window.removeEventListener('storage', refreshStyleGender);
    };
  }, []);

  return (
    <div
      className={`min-h-screen pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] ${
        isGirlsTheme
          ? '-mx-4 bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(207,236,243,0.32),transparent_30%),linear-gradient(180deg,#FFF5F5_0%,#F7D6D0_52%,#FFF5F5_100%)] px-4 text-[#4A4A4A] sm:-mx-6 sm:px-6'
          : ''
      }`}
    >
      <div className="px-4 pt-2 sm:px-6">
        <Header title="Shop" onBack={onBack} compact titleClassName="font-brand text-[2rem]" />
      </div>

      <main className="space-y-5 px-4 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {shopFilters.map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? isGirlsTheme
                      ? 'border-[#D78DA4] bg-[#F6B6C8] text-[#4A4A4A] shadow-[0_12px_28px_rgba(183,110,138,0.20)]'
                      : 'border-accent bg-accent text-black'
                    : isGirlsTheme
                      ? 'border-[#E2B4BD]/55 bg-white/65 text-[#795E67] hover:border-[#D78DA4] hover:text-[#4A4A4A]'
                      : 'border-white/12 bg-white/[0.05] text-text-secondary hover:border-accent/40 hover:text-text-primary'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {activeFilter === 'Books' ? (
          <BooksLibrary embedded onBack={() => setActiveFilter('Creatine')} themeVariant={isGirlsTheme ? 'girls' : 'default'} />
        ) : (
          <section className="grid place-items-center gap-4 sm:grid-cols-2">
            {activeProducts.map((product) => (
              <article key={product.id} className="shop-product-card">
                <div className={`shop-product-orb bg-gradient-to-br ${product.tone}`}>
                  <img src={product.image} alt="" aria-hidden="true" className="shop-product-orb-image" />
                </div>

                <div className="shop-product-content">
                  <div className="shop-product-detail">
                    <span>{product.title}</span>
                    <p>{product.detail}</p>
                    <strong>${product.price}</strong>
                    <button type="button">
                      <ShoppingBag size={13} />
                      Buy
                    </button>
                  </div>

                  <div className="shop-product-image-wrap">
                    <div className={`shop-product-image-box bg-gradient-to-br ${product.tone}`}>
                      <img src={product.image} alt="" aria-hidden="true" className="shop-product-image" />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

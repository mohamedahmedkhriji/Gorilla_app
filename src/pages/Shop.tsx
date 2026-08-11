import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { emojiAutoNutrition, emojiMyNutrition, emojiShop } from '../services/emojiTheme';

interface ShopProps {
  onBack: () => void;
}

const supplementFilters = ['Creatine', 'Protein', 'Pre-workout'] as const;
type SupplementFilter = (typeof supplementFilters)[number];

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

export function Shop({ onBack }: ShopProps) {
  const [activeFilter, setActiveFilter] = useState<SupplementFilter>('Creatine');
  const activeProducts = productsByFilter[activeFilter];

  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      <div className="px-4 pt-2 sm:px-6">
        <Header title="Shop" onBack={onBack} compact titleClassName="font-brand text-[2rem]" />
      </div>

      <main className="space-y-5 px-4 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {supplementFilters.map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-accent bg-accent text-black'
                    : 'border-white/12 bg-white/[0.05] text-text-secondary hover:border-accent/40 hover:text-text-primary'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

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
      </main>
    </div>
  );
}

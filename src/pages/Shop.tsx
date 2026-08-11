import React, { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { emojiShop } from '../services/emojiTheme';

type ShopCategory = 'all' | 'gear' | 'nutrition' | 'premium';

interface ShopProps {
  onBack: () => void;
}

interface ShopItem {
  id: string;
  title: string;
  category: Exclude<ShopCategory, 'all'>;
  price: number;
  tag: string;
  description: string;
}

const categories: Array<{ id: ShopCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'gear', label: 'Gear' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'premium', label: 'Premium' },
];

const shopItems: ShopItem[] = [
  {
    id: 'rep-wraps',
    title: 'RepSet Wrist Wraps',
    category: 'gear',
    price: 19,
    tag: 'Best seller',
    description: 'Stable support for heavy push days and clean pressing.',
  },
  {
    id: 'training-bottle',
    title: 'Gorilla Bottle',
    category: 'gear',
    price: 14,
    tag: 'Daily',
    description: 'Leak-safe 1L bottle built for gym bags and long sessions.',
  },
  {
    id: 'protein-pack',
    title: 'Protein Starter Pack',
    category: 'nutrition',
    price: 32,
    tag: 'Fuel',
    description: 'Simple post-workout support for recovery and consistency.',
  },
  {
    id: 'creatine',
    title: 'Creatine Essentials',
    category: 'nutrition',
    price: 24,
    tag: 'Strength',
    description: 'A clean basics pack for progressive overload phases.',
  },
  {
    id: 'coach-review',
    title: 'Coach Review',
    category: 'premium',
    price: 49,
    tag: 'Premium',
    description: 'Get your training plan reviewed with focused coach notes.',
  },
  {
    id: 'premium-plan',
    title: 'Premium Plan Upgrade',
    category: 'premium',
    price: 79,
    tag: 'Upgrade',
    description: 'Unlock advanced plan templates and premium progress tools.',
  },
];

export function Shop({ onBack }: ShopProps) {
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('all');
  const [cart, setCart] = useState<Record<string, number>>({});

  const visibleItems = useMemo(() => {
    if (activeCategory === 'all') {
      return shopItems;
    }

    return shopItems.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const totalItems = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const totalPrice = shopItems.reduce((sum, item) => sum + (cart[item.id] ?? 0) * item.price, 0);

  const changeQuantity = (id: string, change: number) => {
    setCart((current) => {
      const nextQuantity = Math.max(0, (current[id] ?? 0) + change);
      const next = { ...current };

      if (nextQuantity === 0) {
        delete next[id];
      } else {
        next[id] = nextQuantity;
      }

      return next;
    });
  };

  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      <div className="px-4 pt-2 sm:px-6">
        <Header title="Shop" onBack={onBack} compact titleClassName="font-brand text-[2rem]" />
      </div>

      <main className="space-y-5 px-4 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/18 via-white/[0.06] to-black/20 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/30 ring-1 ring-white/10">
              <img src={emojiShop} alt="" aria-hidden="true" className="h-11 w-11 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-accent">
                <Sparkles size={16} />
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">RepSet Store</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold leading-tight text-white">Shop your training essentials</h2>
              <p className="mt-1 text-sm text-text-secondary">Gear, nutrition, and premium tools for your next phase.</p>
            </div>
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {categories.map((category) => {
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-accent bg-accent text-black'
                    : 'border-white/12 bg-white/[0.05] text-text-secondary hover:border-accent/40 hover:text-text-primary'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          {visibleItems.map((item) => {
            const quantity = cart[item.id] ?? 0;

            return (
              <article key={item.id} className="rounded-2xl border border-white/12 bg-white/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
                      <Star size={12} />
                      {item.tag}
                    </span>
                    <h3 className="mt-3 text-lg font-bold leading-tight text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{item.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xl font-bold text-white">${item.price}</div>
                  </div>
                </div>

                <div className="mt-4 flex h-11 items-center justify-between rounded-xl border border-white/12 bg-black/20 px-2">
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => changeQuantity(item.id, -1)}
                    disabled={quantity === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-10 text-center text-sm font-bold text-white">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Add ${item.title}`}
                    onClick={() => changeQuantity(item.id, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-black transition-colors hover:bg-accent/90"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="sticky bottom-4 z-20 rounded-2xl border border-white/12 bg-background/95 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-accent">
                <ShoppingBag size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{totalItems} item{totalItems === 1 ? '' : 's'}</p>
                <p className="text-xs text-text-secondary">${totalPrice.toFixed(2)} total</p>
              </div>
            </div>
            <button
              type="button"
              disabled={totalItems === 0}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Checkout
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

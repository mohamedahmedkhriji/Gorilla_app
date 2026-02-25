import React from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Bookmark } from 'lucide-react';
interface BooksLibraryProps {
  onBack: () => void;
}
export function BooksLibrary({ onBack }: BooksLibraryProps) {
  const books = [
  {
    title: 'Starting Strength',
    author: 'Mark Rippetoe',
    desc: 'Basic barbell training guide.'
  },
  {
    title: '5/3/1',
    author: 'Jim Wendler',
    desc: 'The simplest and most effective training system.'
  },
  {
    title: 'Scientific Principles',
    author: 'Dr. Mike Israetel',
    desc: 'Hypertrophy training guide.'
  }];

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title="Training Books" onBack={onBack} />
      </div>

      <div className="px-6 space-y-4">
        {books.map((book, i) =>
        <Card key={i} className="p-4 flex gap-4">
            <div className="w-16 aspect-[2/3] bg-white/10 rounded-lg shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold text-white">{book.title}</h3>
              <p className="text-xs text-text-secondary mb-2">
                by {book.author}
              </p>
              <p className="text-xs text-text-tertiary line-clamp-2">
                {book.desc}
              </p>
              <button className="mt-3 flex items-center gap-1 text-xs font-bold text-accent">
                <Bookmark size={12} /> Save
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>);

}
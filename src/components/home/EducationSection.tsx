import React from 'react';
import { Card } from '../ui/Card';
import { Dumbbell, BookOpen, ChevronRight } from 'lucide-react';
interface EducationSectionProps {
  onExercises: () => void;
  onBooks: () => void;
}
export function EducationSection({
  onExercises,
  onBooks
}: EducationSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider px-1">
        Education
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Card
          onClick={onExercises}
          className="p-4 cursor-pointer border border-accent/30 hover:border-accent transition-colors group">

          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-3">
            <Dumbbell size={20} />
          </div>
          <div className="font-bold text-white mb-1">Exercise Library</div>
          <div className="text-xs text-text-secondary flex items-center gap-1">
            Browse All <ChevronRight size={10} />
          </div>
        </Card>

        <Card
          onClick={onBooks}
          className="p-4 cursor-pointer border border-accent/30 hover:border-accent transition-colors group">

          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mb-3">
            <BookOpen size={20} />
          </div>
          <div className="font-bold text-white mb-1">Training Books</div>
          <div className="text-xs text-text-secondary flex items-center gap-1">
            View Library <ChevronRight size={10} />
          </div>
        </Card>
      </div>
    </div>);

}
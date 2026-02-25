import React from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CheckCircle, Share2, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
interface PostWorkoutSummaryProps {
  onClose: () => void;
}
export function PostWorkoutSummary({ onClose }: PostWorkoutSummaryProps) {
  return (
    <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full min-h-screen">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <motion.div
          initial={{
            scale: 0
          }}
          animate={{
            scale: 1
          }}
          className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">

          <CheckCircle size={48} />
        </motion.div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-light text-white">Workout Complete!</h1>
          <p className="text-text-secondary">Great job crushing Upper Power.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <Card className="text-center py-6">
            <div className="text-2xl font-bold text-white">4,250</div>
            <div className="text-xs text-text-tertiary uppercase mt-1">
              Volume (kg)
            </div>
          </Card>
          <Card className="text-center py-6">
            <div className="text-2xl font-bold text-white">45:00</div>
            <div className="text-xs text-text-tertiary uppercase mt-1">
              Duration
            </div>
          </Card>
        </div>

        <Card className="w-full bg-accent/10 border-accent/20">
          <div className="flex items-start gap-3">
            <TrendingUp className="text-accent shrink-0" size={20} />
            <div>
              <h3 className="font-medium text-white">New Record!</h3>
              <p className="text-xs text-text-secondary mt-1">
                You lifted your heaviest Bench Press yet (65kg).
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-2 text-center w-full">
          <h3 className="text-sm font-medium text-text-secondary">
            Recovery Advice
          </h3>
          <p className="text-sm text-text-tertiary">
            Drink water and aim for 30g of protein within the next hour.
          </p>
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <Button variant="secondary" fullWidth className="gap-2">
          <Share2 size={18} /> Share Workout
        </Button>
        <Button onClick={onClose}>Back to Home</Button>
      </div>
    </div>);

}
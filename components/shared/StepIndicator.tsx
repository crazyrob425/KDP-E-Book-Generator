
import React from 'react';
import { AppStep } from '../../types';
import { BookOpenIcon, EyeIcon, LightBulbIcon, PencilSquareIcon, PhotoIcon } from '../icons';

interface StepIndicatorProps {
  currentStep: AppStep;
  onStepClick: (step: AppStep) => void;
}

const steps = [
  { id: AppStep.MarketResearch, name: 'Research', icon: LightBulbIcon },
  { id: AppStep.Outline, name: 'Outline', icon: PencilSquareIcon },
  { id: AppStep.Content, name: 'Write', icon: BookOpenIcon },
  { id: AppStep.Illustration, name: 'Illustrate', icon: PhotoIcon },
  { id: AppStep.Review, name: 'Review', icon: EyeIcon },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  return (
    <nav className="flex justify-center my-8">
      <ol className="flex items-center space-x-2 sm:space-x-4 md:space-x-8">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.name}>
              <button
                onClick={() => onStepClick(step.id)}
                disabled={step.id > currentStep}
                className={`flex flex-col items-center text-center transition-colors duration-300 disabled:cursor-not-allowed group`}
              >
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                    isCurrent
                      ? 'bg-violet-600 border-violet-500 shadow-lg shadow-violet-600/30'
                      : isCompleted
                      ? 'bg-emerald-600 border-emerald-500 group-hover:bg-emerald-700'
                      : 'bg-slate-700 border-slate-600 text-slate-400'
                  }`}
                >
                  <step.icon className="w-6 h-6 text-white" />
                </div>
                <span
                  className={`mt-2 text-xs sm:text-sm font-medium transition-colors duration-300 ${
                    isCurrent ? 'text-violet-400' : isCompleted ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  {step.name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default StepIndicator;

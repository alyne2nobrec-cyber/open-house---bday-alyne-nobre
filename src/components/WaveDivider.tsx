import React from 'react';

interface WaveDividerProps {
  flip?: boolean;
  colorClass?: string;
  className?: string;
}

export const WaveDivider: React.FC<WaveDividerProps> = ({
  flip = false,
  colorClass = '',
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className={`w-full overflow-hidden leading-none select-none pointer-events-none py-1 sm:py-2 ${
        flip ? 'transform -scale-y-100' : ''
      } ${className}`}
    >
      <svg
        viewBox="0 0 1200 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className={`w-full h-6 sm:h-8 block ${colorClass}`}
      >
        {/* Coral wave line */}
        <path
          d="M0 12 C100 2 200 22 300 12 C400 2 500 22 600 12 C700 2 800 22 900 12 C1000 2 1100 22 1200 12"
          stroke="#CF3B25"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Yellow-sun thinner wave line offset underneath */}
        <path
          d="M0 19 C100 9 200 29 300 19 C400 9 500 29 600 19 C700 9 800 29 900 19 C1000 9 1100 29 1200 19"
          stroke="#F2B84B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.9"
        />
      </svg>
    </div>
  );
};

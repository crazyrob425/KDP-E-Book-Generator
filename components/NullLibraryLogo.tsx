import React from 'react';

/**
 * Null Library logo — a digital brain composed of puzzle pieces,
 * contained within the outline of an open book.
 */
const NullLibraryLogo: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 40,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Null Library logo"
  >
    {/* Book outline — two open pages meeting at spine */}
    <path
      d="M10 18 C10 16 12 14 14 14 L46 14 C48 14 50 16 50 18 L50 82 C50 82 34 78 14 82 C12 82 10 80 10 78 Z"
      stroke="url(#bookGrad)"
      strokeWidth="3"
      fill="rgba(109,40,217,0.08)"
    />
    <path
      d="M90 18 C90 16 88 14 86 14 L54 14 C52 14 50 16 50 18 L50 82 C50 82 66 78 86 82 C88 82 90 80 90 78 Z"
      stroke="url(#bookGrad)"
      strokeWidth="3"
      fill="rgba(109,40,217,0.08)"
    />
    {/* Spine line */}
    <line x1="50" y1="14" x2="50" y2="82" stroke="url(#bookGrad)" strokeWidth="2.5" />

    {/* Left puzzle-piece brain segments */}
    {/* Top-left piece */}
    <path
      d="M20 32 L20 28 C20 26 22 26 22 28 L22 32 L26 32 C26 30 28 30 28 32 C28 34 26 34 26 36 L22 36 L22 40 C22 42 20 42 20 40 L20 36 L16 36 C16 34 14 34 14 32 C14 30 16 30 16 32 Z"
      fill="url(#pieceGrad1)"
      opacity="0.9"
    />
    {/* Top-right piece on left page */}
    <path
      d="M32 32 L32 28 C32 26 34 26 34 28 L34 32 L38 32 C38 30 40 30 40 32 C40 34 38 34 38 36 L34 36 L34 40 C34 42 32 42 32 40 L32 36 L28 36 C28 34 26 34 26 32 C26 30 28 30 28 32 Z"
      fill="url(#pieceGrad2)"
      opacity="0.9"
    />
    {/* Bottom-left piece on left page */}
    <path
      d="M20 46 L20 42 C20 40 22 40 22 42 L22 46 L26 46 C26 44 28 44 28 46 C28 48 26 48 26 50 L22 50 L22 54 C22 56 20 56 20 54 L20 50 L16 50 C16 48 14 48 14 46 C14 44 16 44 16 46 Z"
      fill="url(#pieceGrad3)"
      opacity="0.9"
    />
    {/* Bottom-right piece on left page */}
    <path
      d="M32 46 L32 42 C32 40 34 40 34 42 L34 46 L38 46 C38 44 40 44 40 46 C40 48 38 48 38 50 L34 50 L34 54 C34 56 32 56 32 54 L32 50 L28 50 C28 48 26 48 26 46 C26 44 28 44 28 46 Z"
      fill="url(#pieceGrad4)"
      opacity="0.9"
    />

    {/* Right page puzzle-piece brain segments */}
    {/* Top-left piece on right page */}
    <path
      d="M58 32 L58 28 C58 26 60 26 60 28 L60 32 L64 32 C64 30 66 30 66 32 C66 34 64 34 64 36 L60 36 L60 40 C60 42 58 42 58 40 L58 36 L54 36 C54 34 52 34 52 32 C52 30 54 30 54 32 Z"
      fill="url(#pieceGrad2)"
      opacity="0.9"
    />
    {/* Top-right piece on right page */}
    <path
      d="M70 32 L70 28 C70 26 72 26 72 28 L72 32 L76 32 C76 30 78 30 78 32 C78 34 76 34 76 36 L72 36 L72 40 C72 42 70 42 70 40 L70 36 L66 36 C66 34 64 34 64 32 C64 30 66 30 66 32 Z"
      fill="url(#pieceGrad1)"
      opacity="0.9"
    />
    {/* Bottom-left piece on right page */}
    <path
      d="M58 46 L58 42 C58 40 60 40 60 42 L60 46 L64 46 C64 44 66 44 66 46 C66 48 64 48 64 50 L60 50 L60 54 C60 56 58 56 58 54 L58 50 L54 50 C54 48 52 48 52 46 C52 44 54 44 54 46 Z"
      fill="url(#pieceGrad4)"
      opacity="0.9"
    />
    {/* Bottom-right piece on right page */}
    <path
      d="M70 46 L70 42 C70 40 72 40 72 42 L72 46 L76 46 C76 44 78 44 78 46 C78 48 76 48 76 50 L72 50 L72 54 C72 56 70 56 70 54 L70 50 L66 50 C66 48 64 48 64 46 C64 44 66 44 66 46 Z"
      fill="url(#pieceGrad3)"
      opacity="0.9"
    />

    {/* Neural connection dots — the "digital" aspect */}
    <circle cx="27" cy="38" r="1.5" fill="#a78bfa" opacity="0.7" />
    <circle cx="39" cy="38" r="1.5" fill="#818cf8" opacity="0.7" />
    <circle cx="63" cy="38" r="1.5" fill="#a78bfa" opacity="0.7" />
    <circle cx="75" cy="38" r="1.5" fill="#818cf8" opacity="0.7" />
    <circle cx="27" cy="52" r="1.5" fill="#818cf8" opacity="0.7" />
    <circle cx="39" cy="52" r="1.5" fill="#a78bfa" opacity="0.7" />
    <circle cx="63" cy="52" r="1.5" fill="#818cf8" opacity="0.7" />
    <circle cx="75" cy="52" r="1.5" fill="#a78bfa" opacity="0.7" />

    {/* Gradient defs */}
    <defs>
      <linearGradient id="bookGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
      <linearGradient id="pieceGrad1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#6d28d9" />
      </linearGradient>
      <linearGradient id="pieceGrad2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4f46e5" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
      <linearGradient id="pieceGrad3" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id="pieceGrad4" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
  </svg>
);

export default NullLibraryLogo;

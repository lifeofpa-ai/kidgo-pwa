export function KidgoLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="kidgo"
      role="img"
      className={className}
    >
      {/* k */}
      <path d="M4 4v20M4 14l7-6M4 14l8 10" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* i */}
      <circle cx="20" cy="6" r="1.5" fill="#ea580c"/>
      <path d="M20 11v13" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round"/>
      {/* d */}
      <path d="M34 4v20M34 10c2-2 9-2 9 4v0c0 6-7 6-9 4" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* g */}
      <path d="M54 14a6 6 0 1 1-12 0 6 6 0 0 1 12 0zM54 12v12c0 2-1 3-3 3" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* o */}
      <circle cx="70" cy="14" r="6" stroke="#ea580c" strokeWidth="2.5"/>
      {/* dot accent */}
      <circle cx="82" cy="24" r="2" fill="#f97316" opacity="0.7"/>
    </svg>
  );
}

function BeeIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 30 240 200" className={className} aria-hidden="true">
      <defs>
        <clipPath id="beeBody">
          <ellipse cx={120} cy={150} rx={82} ry={72} />
        </clipPath>
        <clipPath id="beeMouth">
          <path d="M84 142 Q120 154 156 142 Q149 180 120 182 Q91 180 84 142 Z" />
        </clipPath>
      </defs>
      <path d="M100 84 Q94 62 80 54" stroke="#111" strokeWidth={5} fill="none" strokeLinecap="round" />
      <circle cx={78} cy={52} r={7} fill="#111" />
      <path d="M140 84 Q146 62 160 54" stroke="#111" strokeWidth={5} fill="none" strokeLinecap="round" />
      <circle cx={162} cy={52} r={7} fill="#111" />
      <ellipse cx={50} cy={122} rx={32} ry={17} fill="#D6E7F4" transform="rotate(-30 50 122)" />
      <ellipse cx={190} cy={122} rx={32} ry={17} fill="#D6E7F4" transform="rotate(30 190 122)" />
      <ellipse cx={120} cy={150} rx={82} ry={72} fill="#F5B82E" />
      <g clipPath="url(#beeBody)">
        <rect x={34} y={178} width={172} height={18} fill="#111" />
        <rect x={34} y={206} width={172} height={16} fill="#111" />
      </g>
      <ellipse cx={87} cy={102} rx={33} ry={30} fill="#fff" />
      <ellipse cx={153} cy={102} rx={33} ry={30} fill="#fff" />
      <ellipse cx={95} cy={105} rx={13} ry={16} fill="#111" />
      <ellipse cx={145} cy={105} rx={13} ry={16} fill="#111" />
      <path d="M84 142 Q120 154 156 142 Q149 180 120 182 Q91 180 84 142 Z" fill="#111" />
      <g clipPath="url(#beeMouth)">
        <ellipse cx={120} cy={184} rx={24} ry={12} fill="#E87C90" />
      </g>
    </svg>
  )
}

export default BeeIcon

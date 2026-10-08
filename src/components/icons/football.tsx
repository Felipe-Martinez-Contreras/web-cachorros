import type { SVGProps } from 'react'

// Set propio de fútbol (especificación 4.8), con el mismo trazo que Lucide. Nunca emojis para los eventos.
// Son decorativos: quien los usa agrega el texto accesible (por ejemplo, «Gol» en la cronología).
type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function BallIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="m12 7.5 4.3 3.1-1.65 5.05h-5.3L7.7 10.6 12 7.5Z" />
      <path d="M12 2.75V7.5M3.2 9.1l4.5 1.5M20.8 9.1l-4.5 1.5M6.6 19.5l2.75-3.85M17.4 19.5l-2.75-3.85" />
    </Icon>
  )
}

/** Tarjeta: el color lo define quien la usa (`text-[#f5c518]` amarilla, `text-live` roja). */
export function CardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="3.5" width="10" height="17" rx="1.5" fill="currentColor" />
    </Icon>
  )
}

/** Segunda amarilla: una amarilla y, encima, la roja. */
export function SecondYellowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="3.5" width="9" height="15" rx="1.5" fill="#f5c518" stroke="#f5c518" />
      <rect x="10.5" y="5.5" width="9" height="15" rx="1.5" fill="#d7263d" stroke="#d7263d" />
    </Icon>
  )
}

export function SubstitutionIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 20V5M7 5 3.5 8.5M7 5l3.5 3.5" stroke="#1f7a4d" />
      <path d="M17 4v15M17 19l-3.5-3.5M17 19l3.5-3.5" stroke="#d7263d" />
    </Icon>
  )
}

export function WhistleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9.5h11.5l6-2.5v4l-4.2 1.2A6 6 0 1 1 5.6 9.5" />
      <circle cx="10.5" cy="14" r="2" />
      <path d="M12 3.5v2.5M8.5 4.5 9.5 6.5M15.5 4.5l-1 2" />
    </Icon>
  )
}

export function PitchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="1.5" />
      <path d="M12 4.75v14.5M2.75 9h3.5v6h-3.5M21.25 9h-3.5v6h3.5" />
      <circle cx="12" cy="12" r="2.5" />
    </Icon>
  )
}

export function PenaltyMissIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
    </Icon>
  )
}

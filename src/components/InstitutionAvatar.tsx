import { useMemo, useState } from 'react'

interface InstitutionAvatarProps {
  name: string
  iconUrl?: string | null
  iconCandidates?: string[]
  size?: number
  logoScale?: number
  logoOffsetX?: number
  logoOffsetY?: number
}

const PALETTE = ['#124559', '#598392', '#aec3b0', '#01161e', '#3f3d56', '#2f4858']

export function InstitutionAvatar({
  name,
  iconUrl,
  iconCandidates,
  size = 32,
  logoScale = 1,
  logoOffsetX = 0,
  logoOffsetY = 0,
}: InstitutionAvatarProps) {
  const [failedByKey, setFailedByKey] = useState<Record<string, number>>({})

  const candidates = useMemo(() => {
    const values = iconCandidates && iconCandidates.length > 0 ? iconCandidates : [iconUrl]
    return values.filter((candidate): candidate is string => Boolean(candidate))
  }, [iconCandidates, iconUrl])

  const candidatesKey = useMemo(() => candidates.join('|'), [candidates])
  const candidateListKey = useMemo(() => `${name}|${candidatesKey}`, [name, candidatesKey])
  const candidateIndex = failedByKey[candidateListKey] ?? 0

  const initials = useMemo(() => {
    const parts = name
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length === 0) {
      return '??'
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }, [name])

  const background = useMemo(() => {
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return PALETTE[hash % PALETTE.length]
  }, [name])

  const currentCandidate = candidates[candidateIndex]
  const imageTransform = `translate(${logoOffsetX}px, ${logoOffsetY}px) scale(${logoScale})`

  if (currentCandidate) {
    return (
      <div
        className="institution-avatar-shell"
        style={{ width: size, height: size }}
        aria-label={name}
        title={name}
      >
        <img
          src={currentCandidate}
          alt={name}
          width={size}
          height={size}
          className="institution-avatar"
          loading="lazy"
          style={{ transform: imageTransform }}
          onError={() =>
            setFailedByKey((previous) => ({
              ...previous,
              [candidateListKey]: (previous[candidateListKey] ?? 0) + 1,
            }))
          }
        />
      </div>
    )
  }

  return (
    <div
      className="institution-avatar-shell institution-avatar-fallback"
      style={{ width: size, height: size, backgroundColor: background }}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  )
}

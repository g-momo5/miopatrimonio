import { useMemo, useState } from 'react'

interface InstitutionAvatarProps {
  name: string
  iconUrl?: string | null
  iconCandidates?: string[]
  size?: number
}

const PALETTE = ['#124559', '#598392', '#aec3b0', '#01161e', '#3f3d56', '#2f4858']

export function InstitutionAvatar({
  name,
  iconUrl,
  iconCandidates,
  size = 32,
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

  if (currentCandidate) {
    return (
      <img
        src={currentCandidate}
        alt={name}
        width={size}
        height={size}
        className="institution-avatar"
        loading="lazy"
        onError={() =>
          setFailedByKey((previous) => ({
            ...previous,
            [candidateListKey]: (previous[candidateListKey] ?? 0) + 1,
          }))
        }
      />
    )
  }

  return (
    <div
      className="institution-avatar fallback"
      style={{ width: size, height: size, backgroundColor: background }}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  )
}

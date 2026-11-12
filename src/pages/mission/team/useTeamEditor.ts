import { useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY_DESIGN, type MissionDesign, type Role } from '../../../game/types'
import { updateDesign, type MissionState } from '../../../multiplayer/missionApi'
import { errorText } from '../../../multiplayer/useMissionRoom'
import { ROLE_NAMES, type DesignEditor } from '../design/editor'

/** The room's saved design, with empty sections filled in */
export function roomDesign(room: MissionState): MissionDesign {
  const d = room.design
  return {
    planner: { ...EMPTY_DESIGN.planner, ...d.planner },
    engineer: { ...EMPTY_DESIGN.engineer, ...d.engineer },
    science: { ...EMPTY_DESIGN.science, ...d.science },
    comms: { ...EMPTY_DESIGN.comms, ...d.comms },
  }
}

/**
 * The shared spacecraft of a team room, as a DesignEditor for the Briefing and Builder.
 * A choice shows at once on this phone, is saved with update_design, and reaches
 * the rest of the crew through the room's 'design' broadcast.
 */
export function useTeamEditor(
  room: MissionState,
  userId: string | null,
  reload: () => Promise<void>,
  setError: (e: string | null) => void,
): DesignEditor {
  // Choices this phone has made but the server hasn't confirmed yet
  const [pending, setPending] = useState<Partial<MissionDesign>>({})
  const saved = useMemo(() => roomDesign(room), [room])
  const design = useMemo(() => ({ ...saved, ...pending }), [saved, pending])
  // Two quick edits in a row must build on each other, not on a stale render
  const latest = useRef(design)
  useEffect(() => {
    latest.current = design
  }, [design])

  return useMemo(() => {
    const holder = (section: Role) => room.crew.find((c) => c.role === section)
    const host = room.crew.find((c) => c.is_host)
    const canEdit = (section: Role) => {
      if (room.phase !== 'lobby' && room.phase !== 'design') return false
      const h = holder(section)
      return h ? h.user_id === userId : room.is_host
    }

    function save<S extends Role>(section: S, value: MissionDesign[S]) {
      if (!canEdit(section)) return
      latest.current = { ...latest.current, [section]: value }
      setPending((p) => ({ ...p, [section]: value }))
      updateDesign(room.room_id, section, value)
        .then(() => reload())
        .catch((e) => setError(errorText(e)))
        .finally(() =>
          setPending((p) => {
            if (p[section] !== value) return p // a newer choice is on its way
            const rest = { ...p }
            delete rest[section]
            return rest
          }),
        )
    }
    const cur = () => latest.current

    return {
      design,
      team: true,
      canEdit,
      owner: (section) => {
        const h = holder(section) ?? host
        if (!h) return null
        return h.user_id === userId ? 'You' : `${h.nickname} (${holder(section) ? ROLE_NAMES[section] : 'host'})`
      },
      setScenario: (id) => save('planner', { ...cur().planner, scenarioId: id }),
      setDifficulty: (difficulty) => save('planner', { ...cur().planner, difficulty }),
      setLifetime: (months) => save('planner', { ...cur().planner, targetLifetimeMonths: months }),
      setPart: (slot, id) => save('engineer', { ...cur().engineer, [slot]: id }),
      setRadio: (id) => save('comms', { ...cur().comms, radioId: id }),
      toggleInstrument: (id) => {
        const ids = cur().science.instrumentIds
        save('science', { instrumentIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
      },
      setOrbit: (orbitId) => save('comms', { ...cur().comms, orbitId }),
      setRocket: (launchVehicleId) => save('comms', { ...cur().comms, launchVehicleId }),
    }
  }, [design, room, userId, reload, setError])
}

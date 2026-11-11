/** Size and colours of each rocket, shared by the models and the launch scene */

export interface RocketLook {
  height: number
  radius: number
  body: string
  band: string
  stripe: string
  boosters: boolean
  boosterColor: string
}

export const ROCKET_LOOK: Record<string, RocketLook> = {
  'small-launcher': { height: 2.6, radius: 0.18, body: '#1f2937', band: '#0b0f17', stripe: '#22d3ee', boosters: false, boosterColor: '#1f2937' },
  'rideshare-leo': { height: 4, radius: 0.28, body: '#f1f5f9', band: '#111827', stripe: '#22d3ee', boosters: false, boosterColor: '#f1f5f9' },
  'rideshare-geo': { height: 4, radius: 0.28, body: '#f1f5f9', band: '#111827', stripe: '#a78bfa', boosters: false, boosterColor: '#f1f5f9' },
  'medium-launcher': { height: 4.2, radius: 0.3, body: '#f1f5f9', band: '#1e3a8a', stripe: '#ef4444', boosters: true, boosterColor: '#e2e8f0' },
  'deep-rideshare': { height: 4.6, radius: 0.32, body: '#e8751a', band: '#9a4a0c', stripe: '#f8fafc', boosters: true, boosterColor: '#f1f5f9' },
}

/** The nose cone is this many body-radii long */
export const NOSE_LENGTH = 3.4

/** Top of the rocket above its base, for framing the camera */
export const rocketTop = (look: RocketLook) => look.height * 1.15 + look.radius * NOSE_LENGTH

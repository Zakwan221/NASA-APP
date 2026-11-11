/** Tips to win: per mission, for the score, and per difficulty. Plain words. */

export const MISSION_TIPS: Record<string, { tips: string[]; mistakes: string[] }> = {
  'earth-watch': {
    tips: [
      'Pick instruments tagged “Good for this mission”: the infrared camera and the haze spectrometer.',
      'Two instruments need over 20 W. In low orbit, fold-out wings only give about 26 W after Earth’s shadow, so use the large array for two.',
      'Cameras make lots of data. S-band sends about 72 Gbit a month: enough for one camera. Carry two? Use X-band.',
      'Sun-synchronous orbit sees Malaysia best (90%) and lasts 5 years. Low orbit lasts only 2.',
      'Bring an 80 Wh battery: a third of every lap is in Earth’s shadow.',
    ],
    mistakes: [
      'Magnetorquers with cameras: they wobble 5°, so pictures blur and you lose most of the science.',
      'A 3U frame: two instruments make it too heavy.',
      'Sun or asteroid instruments here: they only collect 20% of their science.',
    ],
  },
  'solar-storm': {
    tips: [
      'Fly to the L1 point: you see the Sun 100% of the time, and there is no shadow at all.',
      'At L1 you only need the smallest battery: save the weight and money.',
      'The EUV Sun imager brings most of the science, but needs a star tracker (aims within 0.05°).',
      'Take an X-band radio: it is the cheapest one Earth can hear from L1.',
      'Use the deep-space rideshare to reach L1, and stay under 30 kg.',
    ],
    mistakes: [
      'S-band at L1: it only reaches 40,000 km, so the signal is lost after launch.',
      'Only the magnetometer and particle detector: not quite enough science on their own.',
      'Sun-synchronous orbit: Earth blocks the Sun part of the time, so you see only 40%.',
    ],
  },
  'asteroid-scout': {
    tips: [
      'Only deep space reaches an asteroid, and only the deep-space transponder can be heard from there.',
      'The transponder alone uses 35 W: take the large solar array.',
      'Keep the whole spacecraft under 25 kg so the deep-space rideshare can carry it.',
      'The navigation camera and infrared spectrometer are light and made for asteroids.',
      'No shadow in deep space: the smallest battery is fine.',
    ],
    mistakes: [
      'X-band in deep space: it reaches only 2 million km, the asteroid is 20 million away.',
      'Radar plus everything else: too heavy and too power-hungry for a rideshare.',
      'Planning fewer months than the difficulty needs: the mission can’t succeed.',
    ],
  },
}

export const SCORE_TIPS = [
  {
    label: 'Mission success',
    points: 40,
    how: 'Fly every planned month and send home at least 60% of the science target.',
    tip: 'Keep money for operations (about $0.2 M a month) and pick an orbit that lasts long enough.',
  },
  {
    label: 'Science',
    points: 25,
    how: 'Send home 100% of the science target.',
    tip: 'Right instruments, enough power to run them all the time, and a radio that keeps up.',
  },
  {
    label: 'Efficiency',
    points: 20,
    how: 'Lose no data, finish with money left, and keep the spacecraft healthy.',
    tip: 'Match the radio to your instruments’ data, and don’t spend the last dollar on parts.',
  },
  {
    label: 'Handling surprises',
    points: 15,
    how: 'Ride out solar storms, space junk and glitches without damage.',
    tip: 'Mission control handles surprises for you. A sturdy design with spare power and money left survives them best.',
  },
]

export const DIFFICULTY_TIPS = [
  { name: 'Cadet', text: 'Simple parts, a big budget, and rockets never fail. Perfect for learning.' },
  { name: 'Engineer', text: 'All parts and a year in space. The builds on this page are made for it.' },
  { name: 'Director', text: 'Tight budget, longer missions and riskier launches. Pick the most reliable rocket.' },
  { name: 'Sandbox', text: 'No money limit: try wild designs and see what happens.' },
]

export const GENERAL_TIPS = [
  'Before launch, the “to check” button should show zero problems, or only ones you chose on purpose.',
  'Aim for a launch chance of 95% or more.',
  'After the report, press Redesign: it keeps your spacecraft, so fix one thing and fly again.',
]

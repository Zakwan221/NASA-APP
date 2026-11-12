/**
 * For the Items page: when each item is the right pick, and what to watch out
 * for. Plain words, one sentence each. Keyed by the item's id in the game data.
 */

export interface ItemNote {
  best: string
  watch: string
}

export const ITEM_NOTES: Record<string, ItemNote> = {
  /* ---- frames ---- */
  'frame-3u': { best: 'Tiny missions with one small instrument and a simple radio.', watch: 'Only 4 kg in total: one big instrument and it is full.' },
  'frame-6u': { best: 'A good all-rounder for one or two instruments.', watch: 'Large solar arrays and heavy radios won’t fit.' },
  'frame-12u': { best: 'Most missions: room for big panels, two or three instruments and a strong radio.', watch: 'Heavier than smaller frames, so check the rocket can lift it.' },
  'bus-micro': { best: 'Heavy instruments like radar, or lots of them.', watch: 'Weighs 15 kg on its own: too heavy for the cheap rideshare rockets.' },

  /* ---- solar ---- */
  'solar-body': { best: 'Very small, low-power spacecraft. Nothing can fail to unfold.', watch: 'Only 8 W: barely enough for the computer and radio.' },
  'solar-deploy': { best: 'Most missions with one or two instruments.', watch: 'In low orbits you only get about two thirds of it, because of Earth’s shadow.' },
  'solar-large': { best: 'Power-hungry missions: several instruments, X-band or deep-space radios.', watch: 'Heavy and costly; overkill for one small camera.' },

  /* ---- batteries ---- */
  'battery-20': { best: 'L1 and deep space, where the Sun is never hidden.', watch: 'In low orbits it empties fast in Earth’s shadow.' },
  'battery-80': { best: 'Low and sun-synchronous orbits with normal instruments.', watch: 'Several big instruments may still switch off in the shadow.' },
  'battery-200': { best: 'Power-hungry instruments in orbits with long shadows.', watch: 'Heavy. Not needed where there is no shadow.' },

  /* ---- computers ---- */
  'obc-basic': { best: 'Instruments that make little data, like magnetometers.', watch: 'Only 2 GB: a camera fills it in a day.' },
  obc: { best: 'Most missions, with a fast enough radio.', watch: 'If the radio is slow, 8 GB still fills up and data is lost.' },
  'obc-big': { best: 'Far orbits with slow radios: it holds weeks of data.', watch: 'Uses twice the power; a faster radio is often the better fix.' },

  /* ---- pointing ---- */
  magnetorquers: { best: 'Instruments that don’t need careful aiming (magnetometers, particle detectors).', watch: 'Wobbles by 5°: cameras end up blurry.' },
  wheels: { best: 'Cameras and most spectrometers (aims within 0.1°).', watch: 'Not precise enough for the EUV Sun imager.' },
  'star-tracker': { best: 'The sharpest instruments, like the EUV Sun imager.', watch: 'Costs more and uses more power than wheels alone.' },

  /* ---- radios ---- */
  uhf: { best: 'Very low-data missions close to Earth.', watch: 'Far too slow for pictures, and only reaches 2,000 km.' },
  sband: { best: 'Low orbits and GEO with one camera.', watch: 'Two cameras make more data than it can send.' },
  xband: { best: 'Lots of data, or orbits as far as L1.', watch: 'Uses 15 W: you may need bigger solar panels.' },
  'deep-transponder': { best: 'Deep space: the only radio Earth can hear from millions of km.', watch: 'Uses 35 W and is the most expensive radio.' },

  /* ---- instruments ---- */
  camera: { best: 'Earth watch: seeing smoke plumes.', watch: 'Makes lots of data. Needs a good radio or big storage.' },
  'thermal-ir': { best: 'Earth watch: spots fires even through smoke and at night.', watch: 'Uses 12 W, more than the colour camera.' },
  spectro: { best: 'Earth watch: measures how much smoke is in the air. Big science.', watch: 'Needs aiming within 0.2°: use reaction wheels.' },
  magnetometer: { best: 'Solar storm: cheap, light and tiny on power.', watch: 'Small science on its own; pair it with other Sun instruments.' },
  particle: { best: 'Solar storm: counts the particles that harm satellites.', watch: 'Medium science; works best with the EUV imager.' },
  'euv-imager': { best: 'Solar storm: the most science, seeing storms leave the Sun.', watch: 'Needs a star tracker (0.05°) and lots of power and data.' },
  'nav-camera': { best: 'Asteroid scout: light and low-data.', watch: 'Less science than the spectrometer.' },
  'nir-spectro': { best: 'Asteroid scout: finds what the asteroid is made of. Big science.', watch: 'Needs aiming within 0.1°.' },
  radar: { best: 'Asteroid scout with power to spare: the most science.', watch: 'Uses 30 W and weighs 4 kg: hard to fit on a rideshare.' },

  /* ---- orbits ---- */
  leo: { best: 'Cheap, close Earth missions.', watch: 'Air drag ends it in about 2 years, and a third of each lap is in shadow.' },
  sso: { best: 'Earth watch: same light every day, great views.', watch: 'Still a third of each lap in shadow: bring a real battery.' },
  geo: { best: 'Watching one half of Earth all day, always in contact.', watch: 'Needs a radio that reaches 36,000 km and a rocket that can get there.' },
  l1: { best: 'Solar storm: the Sun is never hidden, so a perfect view.', watch: 'Needs an X-band radio or better, and a deep-space rideshare.' },
  'deep-space': { best: 'Asteroid scout: flying past a near-Earth asteroid.', watch: 'Only a deep-space transponder can be heard from there.' },

  /* ---- rockets ---- */
  'rideshare-leo': { best: 'Small spacecraft to low or sun-synchronous orbit. Cheap and reliable.', watch: 'Only 25 kg, and only to low orbits.' },
  'small-launcher': { best: 'Heavier spacecraft in low orbit, when you need your own ride.', watch: 'Costs $7.5 M and fails more often (about 6%).' },
  'rideshare-geo': { best: 'Small spacecraft to geostationary orbit.', watch: 'Only 30 kg, and only to GEO.' },
  'deep-rideshare': { best: 'L1 and deep space for small spacecraft.', watch: 'L1 30 kg, deep space 25 kg. Keep it light.' },
  'medium-launcher': { best: 'Heavy spacecraft to any orbit.', watch: '$18 M: more than most mission budgets.' },
}

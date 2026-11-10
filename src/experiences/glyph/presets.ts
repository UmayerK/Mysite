export interface Preset {
  id: string
  name: string
  note: string
  src: string
}

export const PRESETS: Preset[] = [
  {
    id: 'solar',
    name: 'Solar',
    note: 'Three inks, one loop each',
    src: `// Glyph is a tiny language for posters.
// Drag any number. Change any word.
paper cream

ink yellow
circle 50, 52, 31

ink pink
repeat 11 as i {
  rect 0, 58 + i * 5.6, 100, 0.5 + i * 0.5
}

ink blue
move 50, 52 {
  repeat 36 as i {
    turn i * 10 + t * 5
    line 35, 0, 39 + pick(i, 7, 2, 4), 0,
      width: 0.7
  }
}

ink black
text "SOLAR", 50, 134, size: 14,
  weight: 900, align: center, track: 0.3
text "No. 01", 7, 11, size: 2.6, font: mono
`,
  },
  {
    id: 'moire',
    name: 'Moiré',
    note: 'A pattern nobody drew',
    src: `// Two sets of rings, a little apart.
// The pattern between them is drawn nowhere.
paper white
misprint 0
grain 0.3

let gap = 2.3
let drift = sin(t * 28) * 6

outline 0.75
ink blue
repeat 21 as i {
  circle 50 - drift, 60, 1.5 + i * gap
}
ink pink
repeat 21 as i {
  circle 50 + drift, 63, 1.5 + i * gap
}

fill
ink black
text "Moiré", 7, 131, size: 15,
  weight: 300, soft: 100
text "two plates, 42 rings", 93, 131,
  size: 2.6, font: mono, align: right
`,
  },
  {
    id: 'tiles',
    name: 'Tiles',
    note: 'Seeded chance; press the dice',
    src: `// Every tile rolls for a corner and an ink.
// Change the seed, or press the dice.
paper cream
seed 12

let n = 6
let s = 84 / n

repeat n * 8 as k {
  move 8 + (k % n) * s + s / 2,
    8 + floor(k / n) * s + s / 2
  turn floor(rand(0, 4)) * 90
  ink any(pink, blue, yellow)
  wedge -s / 2, -s / 2, s, 0, 90
  if rand() < 0.3 {
    ink any(pink, blue)
    circle 0, 0, s / 4
  }
}

ink black
text "TILES", 8, 133, size: 9, weight: 800,
  font: sans, track: 0.12
text "48 tiles, 1 seed", 92, 133,
  size: 2.6, font: mono, align: right
`,
  },
  {
    id: 'sixty',
    name: 'Sixty',
    note: 'Type, overprinted',
    src: `// The line on my résumé this page grew from:
// a DSL and compiler that cut design tickets 60%.
paper blush
misprint 0.6

ink blue
text "60", 50, 67, size: 64, weight: 900,
  align: center, soft: 100, wonk: 1
ink pink
text "60", 46.5, 64.5, size: 64, weight: 900,
  align: center, soft: 100, wonk: 1

ink black
text "%", 91, 84, size: 17, weight: 300,
  align: right

repeat 7 as i {
  let pulse = sin(i * 42 - t * 70)
  text "FEWER DESIGN TICKETS", 50, 95 + i * 5,
    size: 4.2, weight: 520 + pulse * 380,
    align: center, font: sans, track: 0.1
}

text "A DSL AND COMPILER FOR PRINT TEMPLATES",
  50, 134, size: 2.1, font: mono,
  align: center, track: 0.06
`,
  },
  {
    id: 'orbit',
    name: 'Orbit',
    note: 'Light inks on dark stock',
    src: `// On dark paper the inks add up to light.
paper night
grain 0.35
misprint 0

move 50, 62 {
  outline 0.45
  repeat 3 as k {
    ink pick(k, pink, blue, yellow)
    let twist = 5 + sin(t * 22 + k * 120) * 4
    repeat 22 as i {
      turn i * twist
      poly 0, 0, 3 + i * 2.1, 3 + k
    }
  }
}

ink white
text "ORBIT", 50, 131, size: 9, weight: 700,
  align: center, font: sans, track: 0.5
text "3 plates / 66 polygons", 50, 136.5,
  size: 2.2, font: mono, align: center
`,
  },
]

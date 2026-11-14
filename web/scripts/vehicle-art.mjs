// Shared mechanical drawing: source for website art and the pure on-chain renderer.
// Original fictional vehicles; no external images or manufacturer marks.
export const models = [
  { name: 'Rally hatch', glare: 'M123 45L126 45L154 70L151 69Z', roof: 'M37 91L47 43L111 30L153 35L190 78L235 92L269 114L230 129L29 117Z', glass: 'M55 49L104 39L105 77L47 90ZM114 39L148 43L177 77L116 76Z', detail: 'M37 91L29 74L45 71M49 36L110 23L152 28L153 35M115 82L110 112' },
  { name: 'Drift coupe', glare: 'M162 49L165 50L187 76L183 75Z', roof: 'M23 98L67 80L106 42L151 34L190 43L220 82L252 94L274 115L230 129L25 117Z', glass: 'M78 81L110 49L146 43L145 78ZM155 43L185 50L208 81L155 78Z', detail: 'M24 93L24 78L62 72L66 78L30 84M151 84L144 113M229 89L228 78L244 83L250 95' },
  { name: 'Sport saloon', glare: 'M158 49L161 50L181 74L177 73Z', roof: 'M23 98L61 86L85 47L144 32L182 41L213 78L250 94L272 114L230 129L24 117Z', glass: 'M69 86L91 53L115 46L115 79ZM122 44L142 41L141 77L122 78ZM151 42L177 48L200 79L150 77Z', detail: 'M118 83L112 115M154 83L149 118M83 91L99 88M162 88L178 90' },
  { name: 'Panel van', glare: 'M145 34L148 35L176 69L172 68Z', roof: 'M22 102L24 35L132 15L173 22L210 78L251 94L272 115L230 129L23 117Z', glass: 'M137 25L167 31L196 78L139 70Z', detail: 'M33 47L120 30L120 89L32 105ZM133 77L130 115M142 85L158 87' },
  { name: 'Utility pickup', glare: 'M157 36L160 37L179 70L175 69Z', roof: 'M23 100L24 70L95 56L99 28L146 18L180 26L211 79L251 94L272 115L230 129L24 117Z', glass: 'M105 36L141 27L142 70L103 79ZM151 28L175 34L197 78L151 72Z', detail: 'M30 74L86 63L87 91L30 106M96 88L93 117M153 80L147 116M111 88L126 86' },
  { name: 'Mid-engine wedge', glare: 'M171 57L175 58L194 78L190 77Z', roof: 'M20 104L56 80L112 58L158 39L194 46L224 84L260 100L277 115L230 129L21 118Z', glass: 'M75 83L117 64L153 48L152 83ZM163 48L190 54L212 83L162 83Z', detail: 'M25 92L24 72L68 65L70 72L32 81M99 99L134 88L126 113ZM164 89L158 116M233 94L253 101' },
];
export const ink = '#0b0b0c', white = '#ffffff';
const path = (d, fill=ink, stroke=white, w=1) => `<path d='${d}' fill='${fill}' stroke='${stroke}' stroke-width='${w}'/>`;
export function vehicleParts(shape=0) {
 const m=models[shape%models.length];
 const wheel=(x,y,r)=>`<g transform='translate(${x} ${y}) rotate(-12)'><ellipse rx='${r*.73}' ry='${r}' fill='${ink}' stroke='${white}' stroke-width='2'/><ellipse rx='${r*.5}' ry='${r*.78}' fill='${ink}' stroke='${white}' stroke-width='1'/><path d='M0 -${r*.7}V${r*.7}M-${r*.45} 0H${r*.45}M-${r*.32} -${r*.49}L${r*.32} ${r*.49}M-${r*.32} ${r*.49}L${r*.32} -${r*.49}' stroke='${white}' stroke-width='1.3'/><ellipse rx='3' ry='4' fill='${white}'/></g>`;
 return [
  `<g stroke-linejoin='miter'>`+path('M17 126L68 142L239 146L283 127L232 116Z',ink,ink),
  path(m.roof,white,ink,2),
  path('M24 104L224 94L271 114L267 133L228 145L24 125Z',ink,white,1.5),
  path('M26 103L192 83L224 94L228 118L30 124Z',white,ink,1.5),
  path('M40 107L186 89L202 96L45 118Z',ink,ink),
  path(m.glass,ink,white,1.2),
  path(m.glare,white,white,.4),
  path(m.detail,'none',ink,1.7),
  path('M194 83L220 80L255 95L224 106Z',white,ink,1.4),
  path('M204 85L221 84L245 94L225 99Z',ink,ink),
  path('M229 118L266 107L267 116L233 127Z',ink,white,1),
  path('M234 121L261 113M234 124L262 116','none',white,.6),
  path('M227 106L240 102L239 107L228 112ZM253 98L264 103L263 108L250 104Z',white,ink,1),
  path('M26 123L222 130L264 119L272 132L230 146L25 132Z',ink,white,1),
  wheel(65,121,21)+wheel(197,126,26),
  path('M43 113Q47 88 65 94Q81 97 83 118M171 118Q176 88 195 93Q217 98 219 124','none',white,1.6),
  path('M126 77L136 74L146 78L145 83L130 82Z',ink,white,1),
  // Accent-only panels; the monochrome body remains dominant.
  path('M87 124L166 127L165 130L87 127Z','ACCENT',ink,.5),
  path('M228 136L265 125L265 128L230 139Z','ACCENT','ACCENT',.5),
  `</g>`
 ];
}
export function vehicleSvg(shape=0, accent='#e4262b', serial=0) {
 const parts=vehicleParts(shape).join('').replaceAll('ACCENT',accent);
 // A small deterministic ventilation pattern gives individual cars mechanical identity.
 const vents=Array.from({length:2+serial%5},(_,i)=>path(`M${91+i*6} 103l3 -1v7l-3 1Z`,ink,white,.5)).join('');
 const identity=Array.from({length:13},(_,i)=>path(`M${87+i*6} 118h4v3h-4Z`,serial&(1<<i)?accent:white,ink,.3)).join('');
 return parts+vents+identity;
}

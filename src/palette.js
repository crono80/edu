// Paleta "Índigo e âmbar": fonte única das cores do MVP (temas claro e escuro), do PDF e das matérias.
// A página de vendas (public/vendas/index.html) é HTML estático e repete os valores do tema claro.
// Contraste conferido (WCAG AA): texto ≥ 4,5:1, linhas de gráfico e contornos ≥ 3:1.

const light = {
  bg: "#f4f4f9",
  surface: "#ffffff",
  sunken: "#ebebf5",
  track: "#dfdfee",
  ink: "#15132b",
  "ink-2": "#4a4866",
  muted: "#64627e",
  line: "#e0dfec",
  "line-strong": "#c4c2d8",
  accent: "#4338ca",
  "accent-hover": "#3730a3",
  "on-accent": "#ffffff",
  "accent-soft": "#e9e7fc",
  "accent-ink": "#3f34c0",
  mark: "#ffd166", // âmbar: fundo de destaque atrás do texto
  knob: "#ffffff",
  // estados: verde = estudado/100%, vermelho = atrasado/reta final, âmbar = revisão
  hi: "#b02424",
  "hi-soft": "#fbe9e8",
  md: "#8a5208",
  "md-soft": "#fcf0dc",
  lo: "#4f4d68",
  "lo-soft": "#eeeef6",
  "warn-soft": "#fdf3dd",
  "warn-line": "#e6c06d",
  good: "#0a6b3a",
  "good-soft": "#e3f3ea",
  // gráficos: seu cronograma na cor da marca, genérico em cinza
  bar: "#5b50e6",
  "series-mine": "#5b50e6",
  "series-generic": "#8e8ca3",
};

const dark = {
  bg: "#0e0d19",
  surface: "#161528",
  sunken: "#1d1c33",
  track: "#292842",
  ink: "#ebeaf5",
  "ink-2": "#b5b3cc",
  muted: "#908ea9",
  line: "#2a2945",
  "line-strong": "#3c3a5c",
  accent: "#a29dff",
  "accent-hover": "#bbb7ff",
  "on-accent": "#13112b",
  "accent-soft": "#262350",
  "accent-ink": "#b6b2ff",
  mark: "#5a4612",
  knob: "#ebeaf5",
  hi: "#ff8f86",
  "hi-soft": "#3b1b1e",
  md: "#f0b455",
  "md-soft": "#33270f",
  lo: "#aeacc4",
  "lo-soft": "#211f36",
  "warn-soft": "#2b2310",
  "warn-line": "#6e5622",
  good: "#5fd49a",
  "good-soft": "#10301f",
  bar: "#8f88ff",
  "series-mine": "#8f88ff",
  "series-generic": "#7b7994",
};

// Até 9 matérias, uma cor cada (conjunto testado para daltonismo; não acompanha a cor da marca).
const subjects = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948", "#0e93a8"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767", "#1aa3bb"],
};

export const PALETTE = { light, dark };
export const SUBJECT_HEX = subjects.light;

/** CSS custom properties for one theme: tokens plus --s1…--s9 for the subjects. */
export function cssVars(theme) {
  const tokens = Object.entries(PALETTE[theme]).map(([k, v]) => `--${k}: ${v};`);
  const subs = subjects[theme].map((v, i) => `--s${i + 1}: ${v};`);
  return [...tokens, ...subs].join(" ");
}

/** "#rrggbb" → [r, g, b] (jsPDF). */
export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const SONG_COLORS = [
  { css: '#ff3b3b', name: 'rouge' },
  { css: '#ff7a1a', name: 'orange' },
  { css: '#ffd51a', name: 'jaune' },
  { css: '#2ee35c', name: 'vert' },
  { css: '#1ad8ff', name: 'cyan' },
  { css: '#3b6bff', name: 'bleu' },
  { css: '#a63bff', name: 'violet' },
  { css: '#ff3bb0', name: 'rose' },
];

export function songColor(index: number) {
  return SONG_COLORS[index % SONG_COLORS.length];
}

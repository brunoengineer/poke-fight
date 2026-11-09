// Legendary battles: the bosses' special attacks and their warnings.
// English in `en`, Portuguese in `pt` (the same keys and {placeholders}; a test checks it).

export const en = {
  'boss.legendary': 'LEGENDARY',
  'boss.enraged': 'ENRAGED!',
  // The banner when an attack starts: its name, then how to survive it.
  'boss.attack.slash': 'Great Slash!',
  'boss.attack.nova': 'Nova!',
  'boss.attack.meteor': 'Sky Fall!',
  'boss.attack.quake': 'Shockwave!',
  'boss.attack.rampage': 'Rampage!',
  'boss.attack.vortex': 'Vortex!',
  'boss.hint.slash': 'No escape: guard ({keyGuard})!',
  'boss.hint.nova': 'Get out of the circle, or guard!',
  'boss.hint.meteor': 'Stay off the red marks!',
  'boss.hint.quake': 'Jump the waves ({keyUp})!',
  'boss.hint.rampage': 'Jump over it, or guard!',
  'boss.hint.vortex': 'Walk away from the pull!',
} as const;

export const pt: Record<keyof typeof en, string> = {
  'boss.legendary': 'LENDÁRIO',
  'boss.enraged': 'ENFURECIDO!',
  'boss.attack.slash': 'Grande Corte!',
  'boss.attack.nova': 'Nova!',
  'boss.attack.meteor': 'Chuva Celeste!',
  'boss.attack.quake': 'Onda de Choque!',
  'boss.attack.rampage': 'Investida!',
  'boss.attack.vortex': 'Vórtice!',
  'boss.hint.slash': 'Não tem como fugir: defenda ({keyGuard})!',
  'boss.hint.nova': 'Saia do círculo, ou defenda!',
  'boss.hint.meteor': 'Fique longe das marcas vermelhas!',
  'boss.hint.quake': 'Pule as ondas ({keyUp})!',
  'boss.hint.rampage': 'Pule por cima, ou defenda!',
  'boss.hint.vortex': 'Ande para longe da atração!',
};

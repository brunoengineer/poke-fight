// The motion input: back, down, forward + the attack button = the elemental special, free (fight/motion.ts).
// English in `en`, Portuguese in `pt` (the same keys and {placeholders}; a test checks it).

export const en = {
  // Under the controls in Training (one short line).
  'motion.hint': 'Free special: ←↓→ + {keyPhysical} (facing right; →↓← facing left), no PP',
  // A full sentence, for a screen that explains the controls.
  'motion.info': 'Back, down, forward, then {keyPhysical} (← ↓ → when facing right): the elemental special, without spending PP.',
} as const;

export const pt: Record<keyof typeof en, string> = {
  'motion.hint': 'Especial grátis: ←↓→ + {keyPhysical} (virado à direita; →↓← à esquerda), sem PP',
  'motion.info': 'Trás, baixo, frente e {keyPhysical} (← ↓ → virado à direita): o especial elemental, sem gastar PP.',
};

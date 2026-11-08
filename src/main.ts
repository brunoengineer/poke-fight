// Entry point: sizes the screen and starts the app (src/app.ts).

import { startApp } from './app';
import { fitCanvas } from './render/screen';
import { readTestOptions } from './test/hooks';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const overlay = document.querySelector<HTMLElement>('#overlay');
if (!canvas || !overlay) throw new Error('missing #screen or #overlay');

const fit = () => fitCanvas(canvas, window.innerWidth, window.innerHeight);
fit();
window.addEventListener('resize', fit);

startApp(canvas, overlay, readTestOptions(location.search));

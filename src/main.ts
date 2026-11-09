// Entry point: sizes the screen and starts the app (src/app.ts).

import { startApp } from './app';
import { fitFrame } from './render/screen';
import { readTestOptions } from './test/hooks';

const frame = document.querySelector<HTMLElement>('#frame');
const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const overlay = document.querySelector<HTMLElement>('#overlay');
const backdrop = document.querySelector<HTMLElement>('#backdrop');
if (!frame || !canvas || !overlay || !backdrop) throw new Error('missing #frame, #screen, #overlay or #backdrop');

// Zooming the page also changes devicePixelRatio, and fires a resize.
const fit = () => fitFrame(frame, canvas, window.innerWidth, window.innerHeight, window.devicePixelRatio);
fit();
window.addEventListener('resize', fit);

const options = readTestOptions(location.search);
// Tests skip the menus' animations (they would only slow every click down).
if (options.enabled) document.documentElement.dataset.test = '';
startApp({ frame, canvas, overlay, backdrop }, options);

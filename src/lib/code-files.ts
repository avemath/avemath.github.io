// The whole files shown in the Code tabs. Each is served as JSON at /code/<key>.json, built from
// the source at build time, and fetched only when its tab first opens, so the home page does not
// carry three source files it may never show.
import pico from '../../vendor/rampage/pico_direct.py?raw';
import ofdmRx from './ofdm-rx.ts?raw';
import v2vTxrx from '../../vendor/v2v/V2V_TXRXf.m?raw';
import ledFw from './led-firmware.ts?raw';
import type { Lang } from './excerpt';

export const codeFiles: Record<string, { source: string; lang: Lang }> = {
  'pico-direct': { source: pico, lang: 'py' },
  'ofdm-rx': { source: ofdmRx, lang: 'ts' },
  'v2v-txrx': { source: v2vTxrx, lang: 'matlab' },
  'led-firmware': { source: ledFw, lang: 'ts' },
};

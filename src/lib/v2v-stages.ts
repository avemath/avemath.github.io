// The nine stages of the V2V receiver, in the order V2V_TXRXf.m runs them. The live figure, the
// How it works view and the Code tab all read this list. `lines` holds the first and last line of
// each stage in vendor/v2v/V2V_TXRXf.m, found by text so they follow the file.
import source from '../../vendor/v2v/V2V_TXRXf.m?raw';
import { lineOf } from './excerpt';

export interface V2vStage {
  key: string;
  name: string;
  text: string;
  io: string;
  /** One line under the plot: what this stage did and why its picture looks the way it does. */
  look: string;
  lines: [number, number];
}

const span = (from: string, to: string): [number, number] => {
  const a = lineOf(source, from);
  return [a, lineOf(source, to, a)];
};

export const v2vStages: V2vStage[] = [
  {
    key: 'detect',
    name: 'PRE detect',
    text: 'Cross-correlates the samples with the known BPSK preamble: 63 symbols, 16 samples each, root-raised-cosine pulses. One peak per packet gives coarse timing.',
    io: 'Takes raw samples from the radio; hands a rough packet start to the tau sweep.',
    look: 'Timing found, nothing corrected yet: the 5 kHz carrier offset still spins the preamble symbols round a ring.',
    lines: span('%% RX-3b. PRE cross-correlation', "'MinPeakDistance'"),
  },
  {
    key: 'tau',
    name: 'Tau sweep',
    text: 'Tries every sampling phase from 0 to 15 and keeps the one with the best preamble score. On the hardware the best tau was 0 in every run.',
    io: 'Takes the rough start; hands on-time symbols to CFO. They still spin from the frequency offset.',
    look: 'Only the sampling phase changes here, and it was already right (the best tau was 0), so the ring looks the same as after detection.',
    lines: span('% tau-sweep over', 'tauBest_try = tauList_try(bestTauIdx_try);'),
  },
  {
    key: 'cfo',
    name: 'CFO',
    text: 'Estimates the carrier frequency offset from the phase step between preamble symbols and spins it out. The transmitter adds 5000 Hz on purpose; the radios’ own oscillators added more, for estimates of about minus 5100 to minus 5900 Hz. Anything over 200 kHz is rejected.',
    io: 'Takes spinning symbols; hands nearly still ones to the TRAIN fit.',
    look: 'With the offset spun out the ring collapses into two clusters, still tilted by the leftover phase.',
    lines: span('% CFO from PRE phase increments', 'rxSig    = rxSig .* exp(-1j*2*pi*(CFO_try/Fs)*n_rx_try);'),
  },
  {
    key: 'train',
    name: 'TRAIN fit',
    text: 'Fits a line to the phase across the 256 known training symbols: a static offset plus a linear drift. Removing it and fixing the polarity puts the symbols back on the real axis.',
    io: 'Takes nearly still symbols; hands them, without the drift, to the PLL.',
    look: 'The line fit removes the static phase and the drift, so the two clusters sit on the real axis.',
    lines: span('% TRAIN polyfit', 'rxSig(trainStart_try:end) = rxSig(trainStart_try:end) .* rotTail_try;'),
  },
  {
    key: 'pll',
    name: 'PLL',
    text: 'Decision-directed PLL. Tracks the phase still left on the preamble, one symbol at a time, steered by its own decisions: loop gain 0.001, after an 8-symbol burn-in.',
    io: 'Takes the fitted symbols; hands phase-locked samples to the OFDM payload.',
    look: 'The loop trims the last of the phase, and the clusters tighten around plus and minus one.',
    lines: span('% PLL on PRE', 'rxSig = rxSig .* exp(-1j * phi_hat_try);'),
  },
  {
    key: 'ofdm',
    name: 'OFDM',
    text: 'Strips the 16-sample cyclic prefix (1.6 µs at 10 MHz) and takes the FFT. The received OFDM preamble divided by the known one gives the channel Hk on each subcarrier: 52 at 156.25 kHz, 48 for data and 4 pilots at ±7 and ±21.',
    io: 'Takes payload samples; hands raw subcarriers and Hk to MMSE.',
    look: 'After the FFT and before equalizing, each subcarrier still carries its own channel gain and phase, so the points scatter. That is expected: MMSE is next.',
    lines: span('% slice and demod', 'H_est_try              = repmat'),
  },
  {
    key: 'mmse',
    name: 'MMSE',
    text: 'Equalizes each subcarrier with Hk and the noise variance, so a weak subcarrier is corrected without blowing up its noise. The points land back on plus and minus one.',
    io: 'Takes raw subcarriers; hands equalized BPSK symbols to Viterbi.',
    look: 'Dividing each subcarrier by its channel estimate puts the points back on plus and minus one.',
    lines: span('noiseWinEnd_try   =', 'rxEq_try = '),
  },
  {
    key: 'viterbi',
    name: 'Viterbi',
    text: 'Decodes the rate 1/2, K=7 convolutional code with polynomials [171 133], the 802.11p code. The browser port stops just before it, so this view shows the hard decisions it is fed.',
    io: 'Takes coded bits; hands the 80-bit message to the BSM parser.',
    look: 'The decoder is fed these same equalized symbols, so the picture matches MMSE; what it hands on is bits, shown at BSM.',
    lines: span('rxCoded_try = pskdemod', 'rxBits_try  = rxBits_try(1:80);'),
  },
  {
    key: 'bsm',
    name: 'BSM',
    text: 'Unpacks each car’s Basic Safety Message from its 80 bits: ID, velocity, acceleration, position X and position Y. Then it computes time to collision and decides on a brake warning.',
    io: 'Takes the decoded message; hands a brake warning to the driver.',
    look: 'The fields each car decoded, next to the ones it sent: they match.',
    lines: span('%% RX-8.', "WARNING: Brake Recommended"),
  },
];

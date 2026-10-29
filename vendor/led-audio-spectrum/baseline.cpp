  // 3) Baseline + thresholds
  bool warmingUp = (millis() - startMs < WARMUP_MS);
  if (noiseBaseline < 0.1) noiseBaseline = ampSmoothed;

  enterThreshold = noiseBaseline * ENTER_MULT + ENTER_ADD;
  exitThreshold  = noiseBaseline * EXIT_MULT  + EXIT_ADD;

  // safety minimums
  if (enterThreshold < 25) enterThreshold = 25;
  if (exitThreshold  < 18) exitThreshold  = 18;

  // Update baseline ONLY when confidently quiet (below exit threshold),
  // so music doesn't poison the baseline.
  if (warmingUp || ampSmoothed < exitThreshold) {
    double a = warmingUp ? BASELINE_ALPHA_FAST : BASELINE_ALPHA_SLOW;
    noiseBaseline = noiseBaseline * (1.0 - a) + ampSmoothed * a;
  }

// When each cause counts as supported (PLAN.md, cause tests). Specialists
// report against these; the checker refuses a "supported" that doesn't pass.

export const THRESHOLDS = {
  C1_unit_price_change_pct: 1, // unit price differs by 1% or more
  C2_standing_change_p_per_day: 0.5, // standing charge differs by 0.5p a day or more
  C3_period_change_days: 2, // bill length differs by 2 days or more
  C4_estimate_share_pct: 2, // an estimate moved billed units by more than 2%
  C6_weather_share_pct: 20, // weather is 20% or more of the change in use, same direction
  C6_min_r2: 0.5, // and use follows the weather well enough to trust the fit
  C7_other_change_pct: 10, // use beyond the weather moves daily use by 10% or more
  C8_other_rise_pct: 15, // water: use beyond the weather up 15% or more, with no note to explain it
  min_fit_points: 3, // bills needed before fitting use against the weather
} as const;

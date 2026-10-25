/** Display-only typography. Matching and calculation keep their original definitions. */
export function symbol(value: string) {
  return (
    (
      { theta: 'θ', omega: 'ω', lambda: 'λ', rho: 'ρ', tau: 'τ', dT: 'ΔT', dt: 'Δt' } as Record<
        string,
        string
      >
    )[value] ?? value
  );
}
export function displayEquation(id: string, equation: string) {
  const special: Record<string, string> = {
    rc: 'V = V_0 e^{-t/(RC)}',
    exponential: 'N = N_0 e^{kt}',
    cooling: 'T = T_{env} + (T_0 − T_{env}) e^{-kt}',
    logistic: 'N = K / [1 + (K/N_0 − 1)e^{-rt}]',
  };
  return (
    special[id] ??
    equation
      .replace(/0\.5\*/g, '½')
      .replace(/\^\(([^()]*)\)/g, '^{$1}')
      .replace(/\*/g, ' · ')
      .replace(/\btheta\b/g, 'θ')
      .replace(/\bomega\b/g, 'ω')
      .replace(/\blambda\b/g, 'λ')
      .replace(/\brho\b/g, 'ρ')
      .replace(/\btau\b/g, 'τ')
      .replace(/\bpi\b/g, 'π')
      .replace(/\bdeltaT\b/g, 'ΔT')
      .replace(/sqrt/g, '√')
  );
}

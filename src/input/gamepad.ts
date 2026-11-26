export function applyDeadzone(
  x: number, y: number, deadzone: number, out: { x: number; y: number },
): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (!Number.isFinite(m) || m < deadzone) { out.x = 0; out.y = 0; return out; }
  const scale = (Math.min(m, 1) - deadzone) / (1 - deadzone) / m;
  out.x = x * scale;
  out.y = y * scale;
  return out;
}

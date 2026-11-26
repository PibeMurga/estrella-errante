export const MSG_NO_WEBGL2 =
  'Tu placa de video o tu navegador no soporta WebGL2, que el juego necesita. Actualizá los drivers de video y volvé a intentar.';
export const MSG_CONTEXT_LOST = 'Se perdió la conexión con la placa de video. Recargando…';

export function getWebGL2(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    return canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
}

export function showFatal(message: string): void {
  const el = document.createElement('div');
  el.className = 'fatal';
  el.textContent = message;
  document.body.appendChild(el);
}

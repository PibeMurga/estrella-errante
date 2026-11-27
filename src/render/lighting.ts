// Luz de la escena compartida entre capas. Siendo planeta no tenés luz propia: todo lo ilumina tenue una estrella lejana
// (level < 1); desde la ignición, tu estrella (level = 1). Las capas que iluminan multiplican su luz por este nivel.
export const sceneLight = { level: 1 };

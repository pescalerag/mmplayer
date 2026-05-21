/**
 * Calcula el color de texto óptimo para que sea legible sobre un fondo de color.
 * Usa la fórmula YIQ que imita la percepción del ojo humano.
 *
 * - Colores CLAROS → texto oscuro (70% del color original)
 * - Colores OSCUROS → texto blanco puro
 */
export const getDynamicTagTextColor = (hexColor: string): string => {
    const hex = hexColor.replace('#', '');

    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;

    // Luminancia perceptual (fórmula YIQ)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;

    if (yiq > 150) {
        // Color claro → texto oscuro (30% del color original)
        const darkR = Math.floor(r * 0.3).toString(16).padStart(2, '0');
        const darkG = Math.floor(g * 0.3).toString(16).padStart(2, '0');
        const darkB = Math.floor(b * 0.3).toString(16).padStart(2, '0');
        return `#${darkR}${darkG}${darkB}`;
    }

    // Color oscuro → texto blanco
    return '#FFFFFF';
};

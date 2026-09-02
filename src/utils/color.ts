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

/**
 * Convierte un código HEX en formato rgba(r, g, b, alpha)
 */
export const hexToRgba = (hexColor: string, alpha: number): string => {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Aclara un color HEX en un porcentaje dado (0 a 1)
 */
export const lightenColor = (hexColor: string, percent: number = 0.22): string => {
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;

    const newR = Math.min(255, Math.floor(r + (255 - r) * percent)).toString(16).padStart(2, '0');
    const newG = Math.min(255, Math.floor(g + (255 - g) * percent)).toString(16).padStart(2, '0');
    const newB = Math.min(255, Math.floor(b + (255 - b) * percent)).toString(16).padStart(2, '0');

    return `#${newR}${newG}${newB}`;
};

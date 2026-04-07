// Fuentes centralizadas para toda la app
// Con Expo y variable fonts, usamos fontFamily + fontWeight en los estilos
export const Fonts = {
    regular: 'Montserrat-Regular',
    bold: 'Montserrat-Bold',
    italic: 'Montserrat-Italic',
    boldItalic: 'Montserrat-BoldItalic',
} as const;

// Mapa de carga para expo-font
export const fontAssets = {
    [Fonts.regular]:   require('../assets/fonts/Montserrat-VariableFont_wght.ttf'),
    [Fonts.bold]:      require('../assets/fonts/Montserrat-VariableFont_wght.ttf'),
    [Fonts.italic]:    require('../assets/fonts/Montserrat-Italic-VariableFont_wght.ttf'),
    [Fonts.boldItalic]:require('../assets/fonts/Montserrat-Italic-VariableFont_wght.ttf'),
};

# MMPlayer 🎵

MMPlayer es la aplicación definitiva de reproducción local diseñada para los verdaderos amantes y coleccionistas de la música.

A diferencia de los reproductores tradicionales, MMPlayer nace con la misión de ofrecer una experiencia premium, altamente personalizable y digna de las mejores plataformas de streaming, manteniendo el control absoluto sobre el 100% de tu biblioteca local.

---

## ✨ Características Principales

### 💎 Estética Premium
Una interfaz moderna, elegante y fluida, inspirada en gigantes como Spotify, Apple Music y YouTube Music. Diseñada con un enfoque "Visual-First" para que tu música no solo suene bien, sino que se vea espectacular.

### 🎨 Personalización Extrema
Toma el control visual absoluto de tu biblioteca:
- Configura portadas únicas para tus listas de reproducción.
- Diseña cabeceras dinámicas para tus artistas y álbumes.
- Elige entre distintos formatos y estilos visuales para explorar tu colección.

### 🏷️ Sistema de Etiquetas Custom
Diseñado para coleccionistas minuciosos. Clasifica tu música al milímetro asignando tags personalizados como:
- **Formatos**: FLAC, WAV, MP3.
- **Origen**: CD-Rip, Vinyl-Rip, Hi-Res.
- **Categorías propias**: Construye la taxonomía de tu colección definitiva.

### 🧠 Organización Inteligente
Olvídate de las listas planas y aburridas.
- **Algoritmos de ordenación avanzada**: Crea playlists a medida con criterios lógicos.
- **Cuadrícula dinámica**: Acceso rápido a tus últimas reproducciones y favoritos.
- **Navegación intuitiva**: Explora por Álbumes, Artistas, Géneros y Favoritos con transiciones fluidas.

---

## 🛠️ Stack Tecnológico

MMPlayer utiliza las tecnologías más punteras del ecosistema móvil para garantizar un rendimiento extremo:

- **Core**: React Native & Expo con TypeScript para un código robusto y tipado.
- **Base de Datos**: Arquitectura relacional offline con [WatermelonDB](https://github.com/Nozbe/WatermelonDB), utilizando SQLite para gestionar miles de pistas con latencia cero.
- **Motor de Audio**: Implementación nativa con [React Native Track Player](https://github.com/doublesymmetry/react-native-track-player), gestionando servicios en segundo plano a nivel de sistema operativo.
- **Gestión de Estado**: Lógica de reproducción centralizada con [Zustand](https://github.com/pmndrs/zustand) para una reactividad instantánea.
- **Arquitectura**: Preparado para la Nueva Arquitectura de React Native (TurboModules).

---

## 🔒 Privacidad Total

En MMPlayer, tus datos son tuyos.
- **100% Offline**: La aplicación no requiere conexión a internet para funcionar.
- **Sin Rastreo**: Tus hábitos de escucha, metadatos y archivos nunca salen de tu dispositivo. No hay servidores intermedios ni telemetría invasiva.

---

## 🚀 Instalación y Desarrollo

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/pescalerag/mmplayer.git
   cd mmplayer
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar Expo**:
   ```bash
   npx expo start
   ```

> [!NOTE]
> Debido a las dependencias nativas de `Track Player` y `WatermelonDB`, se recomienda ejecutar el proyecto mediante `npx expo run:android` para compilar los módulos nativos.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

## 🤝 Contribuciones

¿Tienes una idea para mejorar la personalización o el sistema de etiquetas? ¡Las contribuciones son bienvenidas!

1. Haz un **Fork** del proyecto.
2. Crea una **rama** para tu mejora (`git checkout -b feature/MejoraIncreible`).
3. Envía una **Pull Request**.

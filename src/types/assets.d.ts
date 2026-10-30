declare module '*.png' {
  // Metro uses a numeric asset id; Vite exports the URL of the bundled image.
  const source: number | string | { uri: string };
  export default source;
}

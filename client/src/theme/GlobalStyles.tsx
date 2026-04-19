// GlobalStyles.tsx — re-exports ThemeProvider and provides a convenience hook.
// @font-face declarations are handled by @fontsource imports in main.tsx.
// CSS variable injection is handled by ThemeContext useLayoutEffect.
export { ThemeProvider, useTheme } from './ThemeContext';

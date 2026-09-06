import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Modest web safe-area insets: a little breathing room at top/bottom so screens
// that use SafeAreaView edges don't hug the very edge of the browser window.
export const WEB_SAFE_AREA_INSETS = { top: 12, left: 0, right: 0, bottom: 12 };

// Kept for compatibility with any code importing it; on web the app now fills
// the browser instead of rendering a phone shell.
export const IPHONE_METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

// Measure browser safe-area env() values, including notches and home indicators.
export function SafeAreaShim({ children }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

// Web: run normally — the app fills the full browser viewport. No phone frame.
export default function DeviceFrame({ children }) {
  return (
    <View style={styles.stage}>
      {Platform.OS === 'web' ? <BackdropStyles /> : null}
      {children}
    </View>
  );
}

// Reset default page background/margins so the app fills the browser cleanly.
function BackdropStyles() {
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const id = 'bloom-device-frame-bg';
    if (document.getElementById(id)) return undefined;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      html, body, #root { height: 100%; margin: 0; overflow: hidden; }
      #root { height: var(--bloom-viewport-height, 100dvh); }
      body { overscroll-behavior: none; }
      textarea, input { caret-color: #b52f50; }
      ::selection { background: #fbe5ea; color: #222222; }
      :focus-visible { outline: 2px solid #b52f50; outline-offset: 2px; }
      @media (pointer: fine) { * { scrollbar-width: thin; scrollbar-color: #b7afb3 transparent; } }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0s !important; }
      }
    `;
    document.head.appendChild(style);
    const viewport = window.visualViewport;
    const updateHeight = () => {
      // Preserve pinch zoom; resize only for keyboard and browser chrome.
      if (viewport && viewport.scale !== 1) return;
      document.documentElement.style.setProperty('--bloom-viewport-height', `${viewport?.height || window.innerHeight}px`);
    };
    updateHeight();
    viewport?.addEventListener('resize', updateHeight);
    window.addEventListener('resize', updateHeight);
    return () => {
      style.remove();
      viewport?.removeEventListener('resize', updateHeight);
      window.removeEventListener('resize', updateHeight);
      document.documentElement.style.removeProperty('--bloom-viewport-height');
    };
  }, []);
  return null;
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
  },
});

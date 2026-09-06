import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export default function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = globalThis.visualViewport;
      if (!viewport || typeof document === 'undefined') return undefined;
      const update = () => {
        const editing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        setVisible(editing && viewport.scale === 1 && window.innerHeight - viewport.height > 120);
      };
      viewport.addEventListener('resize', update);
      document.addEventListener('focusin', update);
      document.addEventListener('focusout', update);
      return () => {
        viewport.removeEventListener('resize', update);
        document.removeEventListener('focusin', update);
        document.removeEventListener('focusout', update);
      };
    }
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

export const hapticFeedback = {
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 50, 15]);
    }
  },
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  warning: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 40, 30]);
    }
  },
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50, 50, 50]);
    }
  }
};

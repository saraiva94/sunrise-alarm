import Toast from 'react-native-toast-message';

interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  text1?: string;
  text2?: string;
}

function toast(options: ToastOptions) {
  Toast.show({
    type: options.type || 'info',
    text1: options.text1 || '',
    text2: options.text2 || '',
    visibilityTime: 4000,
    position: 'top',
  });
}

function dismiss() {
  Toast.hide();
}

function useToast() {
  return {
    toast,
    dismiss,
  };
}

export { useToast, toast };

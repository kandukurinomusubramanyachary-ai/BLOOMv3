const React = require('react');
const { View } = require('react-native');
const { registerRootComponent } = require('expo');
let NativeSplashScreen = null;
try {
  NativeSplashScreen = require('expo-splash-screen');
  NativeSplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  NativeSplashScreen = null;
}
const StartupDiagnosticScreen = require('./src/components/StartupDiagnosticScreen').default;
const StartupErrorBoundary = require('./src/components/StartupErrorBoundary').default;
const {
  clearStartupFailure,
  installGlobalErrorHandler,
  loadLastStartupFailure,
  recordStartupFailure,
  setStartupStage,
} = require('./src/diagnostics/startupDiagnostics');

installGlobalErrorHandler();
setStartupStage('native-entry');

let nativeSplashHidden = false;
let nativeSplashHideAttempts = 0;
function hideNativeSplash() {
  if (nativeSplashHidden || nativeSplashHideAttempts >= 2) return;
  if (!NativeSplashScreen?.hideAsync) {
    nativeSplashHidden = true;
    return;
  }
  nativeSplashHideAttempts += 1;
  Promise.resolve(NativeSplashScreen.hideAsync())
    .then(() => {
      nativeSplashHidden = true;
    })
    .catch(() => {
      setTimeout(hideNativeSplash, 250);
    });
}

const nativeSplashFallback = setTimeout(hideNativeSplash, 4000);

function loadBloomApplication() {
  try {
    const applicationModule = require('./App');
    const AppComponent = applicationModule.default || applicationModule;
    if (typeof AppComponent !== 'function') {
      throw new Error('Bloom application entry is unavailable.');
    }
    return {
      status: 'ready',
      AppComponent,
      failure: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      AppComponent: null,
      failure: recordStartupFailure(error, 'app-mounted'),
    };
  }
}

function BloomBootstrap() {
  const [loadState, setLoadState] = React.useState({
    status: 'restoring',
    AppComponent: null,
    failure: null,
  });

  React.useEffect(() => {
    setStartupStage('app-mounted');
    let active = true;

    loadLastStartupFailure().then(async (storedFailure) => {
      if (!active) return;
      const developmentAuthEnabled = typeof __DEV__ !== 'undefined'
        && __DEV__
        && process.env.EXPO_PUBLIC_BLOOM_DEV_AUTH === '1';
      if (storedFailure && developmentAuthEnabled) {
        await clearStartupFailure();
        if (!active) return;
        setLoadState(loadBloomApplication());
        return;
      }
      if (storedFailure) {
        setLoadState({
          status: 'failed',
          AppComponent: null,
          failure: storedFailure,
        });
        return;
      }
      setLoadState(loadBloomApplication());
    });

    return () => {
      active = false;
    };
  }, []);

  const handleFirstLayout = React.useCallback(() => {
    clearTimeout(nativeSplashFallback);
    hideNativeSplash();
  }, []);

  const handleRetry = React.useCallback(async () => {
    await clearStartupFailure();
    setStartupStage('app-mounted');
    setLoadState({
      status: 'restoring',
      AppComponent: null,
      failure: null,
    });
    setLoadState(loadBloomApplication());
  }, []);

  if (loadState.status === 'failed') {
    return React.createElement(
      View,
      { style: { flex: 1, backgroundColor: '#FFFDFE' }, onLayout: handleFirstLayout },
      React.createElement(StartupDiagnosticScreen, {
        failure: loadState.failure,
        onRetry: handleRetry,
      })
    );
  }

  if (loadState.status !== 'ready' || !loadState.AppComponent) {
    return React.createElement(View, {
      style: { flex: 1, backgroundColor: '#FFFDFE' },
      onLayout: handleFirstLayout,
    });
  }

  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: '#FFFDFE' }, onLayout: handleFirstLayout },
    React.createElement(
      StartupErrorBoundary,
      null,
      React.createElement(loadState.AppComponent)
    )
  );
}

registerRootComponent(BloomBootstrap);

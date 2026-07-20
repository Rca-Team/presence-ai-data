import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const SWITCH_LOADER_MS = 520;

const AppExperienceLayer = () => {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [showSwitchLoader, setShowSwitchLoader] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (prevPathRef.current === location.pathname) return;
    prevPathRef.current = location.pathname;
    setShowSwitchLoader(true);
    const t = window.setTimeout(() => setShowSwitchLoader(false), SWITCH_LOADER_MS);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const onOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    const onOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      window.setTimeout(() => setShowRestored(false), 2800);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {showSwitchLoader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[120] bg-background/45 backdrop-blur-[1.5px]"
          >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(92vw,24rem)] rounded-2xl border border-primary/30 bg-card/90 backdrop-blur-xl px-4 py-3 shadow-2xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Switching view
                <Sparkles className="h-4 w-4 text-primary/80 animate-pulse ml-auto" />
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 0.75, ease: 'easeInOut', repeat: Infinity }}
                  className="h-full w-1/2 bg-primary/80"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -70, opacity: 0 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[130] w-[min(94vw,34rem)] rounded-xl border border-destructive/40 bg-destructive/12 backdrop-blur-xl px-4 py-2"
          >
            <div className="flex items-center gap-2 text-sm text-foreground">
              <WifiOff className="h-4 w-4 text-destructive animate-pulse" />
              <span className="font-medium">Network is unstable. Working in retry mode.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOnline && showRestored && (
          <motion.div
            initial={{ y: -70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -70, opacity: 0 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[130] w-[min(94vw,34rem)] rounded-xl border border-primary/40 bg-primary/12 backdrop-blur-xl px-4 py-2"
          >
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Wifi className="h-4 w-4 text-primary" />
              <span className="font-medium">Connection restored. Sync is active.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AppExperienceLayer;
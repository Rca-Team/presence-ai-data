import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, UserPlus, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const navItems = [
  { path: '/', icon: Home, label: 'Home', color: 'ios-blue' },
  { path: '/register', icon: UserPlus, label: 'Register', color: 'ios-green' },
  { path: '/attendance', icon: Clock, label: 'Attend', color: 'ios-purple' },
  { path: '/profile', icon: User, label: 'Profile', color: 'ios-pink' },
];

const MobileNavBar: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { trigger } = useHapticFeedback();

  if (!isMobile) return null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.15 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom"
    >
      {/* Outer frosted-glass shell */}
      <div
        className={cn(
          "mx-3 mb-2 rounded-[28px] overflow-hidden",
          "border border-white/25 dark:border-white/10",
          "bg-white/45 dark:bg-black/35",
          "backdrop-blur-3xl backdrop-saturate-[1.8]",
          "shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18),inset_0_0.5px_0_rgba(255,255,255,0.35)]",
          "dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5),inset_0_0.5px_0_rgba(255,255,255,0.08)]"
        )}
      >
        {/* Subtle top-edge highlight */}
        <div className="absolute inset-x-0 top-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/60 dark:via-white/15 to-transparent" />

        <div className="flex items-center justify-around px-1 py-1.5">
          {navItems.map((item, index) => {
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => trigger('light')}
                className="relative flex flex-col items-center justify-center flex-1 min-h-[56px]"
              >
                {/* Active pill background */}
                <AnimatePresence mode="wait">
                  {active && (
                    <motion.div
                      layoutId="glass-pill"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-x-2 inset-y-1 rounded-[20px]"
                      style={{
                        background: `linear-gradient(160deg, hsl(var(--${item.color}) / 0.22), hsl(var(--${item.color}) / 0.08))`,
                        boxShadow: `0 0 20px hsl(var(--${item.color}) / 0.2), inset 0 0.5px 0 rgba(255,255,255,0.3)`,
                        border: `0.5px solid hsl(var(--${item.color}) / 0.25)`,
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon + Label */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.04, type: 'spring', stiffness: 350, damping: 26 }}
                  whileTap={{ scale: 0.8 }}
                  className="relative z-10 flex flex-col items-center gap-0.5"
                >
                  <motion.div
                    animate={
                      active
                        ? { y: [0, -3, 0], scale: [1, 1.15, 1] }
                        : { y: 0, scale: 1 }
                    }
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <item.icon
                      className={cn(
                        "w-[22px] h-[22px] transition-all duration-300",
                        !active && "text-muted-foreground"
                      )}
                      strokeWidth={active ? 2.4 : 1.8}
                      style={active ? { color: `hsl(var(--${item.color}))` } : undefined}
                    />
                  </motion.div>

                  <span
                    className={cn(
                      "text-[10px] font-semibold tracking-tight transition-colors duration-300",
                      !active && "text-muted-foreground/70"
                    )}
                    style={active ? { color: `hsl(var(--${item.color}))` } : undefined}
                  >
                    {item.label}
                  </span>

                  {/* Glow dot */}
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="w-[5px] h-[5px] rounded-full mt-0.5"
                        style={{
                          background: `hsl(var(--${item.color}))`,
                          boxShadow: `0 0 8px 2px hsl(var(--${item.color}) / 0.5)`,
                        }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
};

export default MobileNavBar;

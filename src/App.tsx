import { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Skeleton } from "@/components/ui/skeleton";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const Index = lazyWithRetry(() => import("./pages/Index"), "index");
const Register = lazyWithRetry(() => import("./pages/Register"), "register");
const Attendance = lazyWithRetry(() => import("./pages/Attendance"), "attendance");
const Login = lazyWithRetry(() => import("./pages/Login"), "login");
const Signup = lazyWithRetry(() => import("./pages/Signup"), "signup");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "not-found");
import Admin from "./pages/Admin";
const Contact = lazyWithRetry(() => import('./pages/Contact'), 'contact');
const NotificationDemo = lazyWithRetry(() => import('./pages/NotificationDemo'), 'notification-demo');
const Profile = lazyWithRetry(() => import('./pages/Profile'), 'profile');
const Features = lazyWithRetry(() => import('./pages/Features'), 'features');
const GateMode = lazyWithRetry(() => import('./pages/GateMode'), 'gate-mode');
const ParentPortal = lazyWithRetry(() => import('./pages/ParentPortal'), 'parent-portal');
const Unsubscribe = lazyWithRetry(() => import('./pages/Unsubscribe'), 'unsubscribe');
const DataBackup = lazyWithRetry(() => import('./pages/DataBackup'), 'data-backup');
const FaceModelValidator = lazyWithRetry(() => import('./pages/FaceModelValidator'), 'face-model-validator');
const TeacherPortal = lazyWithRetry(() => import('./pages/TeacherPortal'), 'teacher-portal');
const OAuthConsent = lazyWithRetry(() => import('./pages/OAuthConsent'), 'oauth-consent');
const Portfolio = lazyWithRetry(() => import('./pages/Portfolio'), 'portfolio');

import { AttendanceProvider } from './contexts/AttendanceContext';
import { motion, useReducedMotion } from 'framer-motion';
import { ThemeProvider } from './hooks/use-theme';
import MobileAppShell from "./components/mobile/MobileAppShell";
import { ProtectedRoute } from './components/ProtectedRoute';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import EmergencyAlertListener from './components/EmergencyAlertListener';
import RealtimeNotificationListener from './components/RealtimeNotificationListener';
import AppExperienceLayer from './components/AppExperienceLayer';
import SplashAnimation from './components/SplashAnimation';
import { areGateDetectionModelsLoaded, loadGateDetectionModels } from '@/services/face-recognition/ModelService';
import NotificationPermissionGate from './components/NotificationPermissionGate';
import { useIsMobile } from "./hooks/use-mobile";

const queryClient = new QueryClient();

queryClient.setDefaultOptions({
  queries: {
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  },
});

const SITE_URL = "https://presences.dev";

const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Presences | Smart School Automation Platform",
    description:
      "Automate school attendance, gate security, parent updates, and timetable management with real-time face recognition.",
  },
  "/contact": {
    title: "Contact Presences | School Automation Support",
    description:
      "Contact the Presences team for school onboarding, technical support, and product demos.",
  },
  "/features": {
    title: "Features | Presences Smart School System",
    description:
      "Explore face attendance, gate mode, parent portal, timetable, alerts, analytics, and automation features in Presences.",
  },
  "/login": {
    title: "Login | Presences",
    description:
      "Sign in to Presences to manage attendance, gate operations, and school workflows securely.",
  },
  "/signup": {
    title: "Create Account | Presences",
    description:
      "Create your Presences account to set up smart attendance, classroom tools, and parent communication.",
  },
  "/parent": {
    title: "Parent Portal | Presences",
    description:
      "Track student attendance, receive notifications, and stay connected with school updates in the Presences Parent Portal.",
  },
  "/register": {
    title: "Student Registration | Presences",
    description:
      "Register students quickly with face data capture and profile setup in the Presences platform.",
  },
  "/portfolio": {
    title: "Gaurav Portfolio Studio | Presences",
    description:
      "Secure portfolio studio with PIN access for editing Gaurav's profile, achievements, gallery, and project highlights.",
  },
  "/unsubscribe": {
    title: "Unsubscribe | Presences Notifications",
    description:
      "Manage and unsubscribe from Presences school notification emails.",
  },
};

const getRouteSeo = (pathname: string) => {
  return (
    ROUTE_SEO[pathname] ?? {
      title: "Presences | Smart School Automation",
      description:
        "AI-powered school automation platform for attendance, security, and parent communication.",
    }
  );
};

function SeoHead() {
  const location = useLocation();
  const { title, description } = getRouteSeo(location.pathname);
  const canonical = `${SITE_URL}${location.pathname}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {location.pathname === "/" && (
        <script type="application/ld+json">
          {JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Presences",
              url: SITE_URL,
              description:
                "AI-powered smart school automation platform for attendance, gate management, and parent communication.",
            },
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Presences",
              url: SITE_URL,
              logo: `${SITE_URL}/logo.png`,
              sameAs: [SITE_URL, `${SITE_URL.replace('https://', 'https://www.')}`],
            },
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Presences",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: SITE_URL,
              description:
                "School automation software for face recognition attendance, gate security, timetable management, and parent portal updates.",
            },
          ])}
        </script>
      )}
    </Helmet>
  );
}

// This component wraps our routes with AnimatePresence for exit animations
function AnimatedRoutes() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const routeFallback = (
    <div className="min-h-[60vh] px-4 py-6 space-y-3">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-44 w-full" />
    </div>
  );
  
  return (
    <Suspense fallback={routeFallback}>
      <motion.div
        key={location.pathname}
        initial={
          isMobile && !prefersReducedMotion
            ? { opacity: 0, x: navigationType === 'POP' ? -16 : 16 }
            : false
        }
        animate={
          isMobile && !prefersReducedMotion
            ? { opacity: 1, x: 0 }
            : { opacity: 1 }
        }
        transition={
          isMobile && !prefersReducedMotion
            ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.01 }
        }
      >
        <Routes location={location}>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/register" element={<Register />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/attendance" element={
              <ProtectedRoute requireRoles={["admin", "principal", "teacher", "user"]}>
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/user" element={
              <ProtectedRoute requireRoles={["admin", "principal", "teacher", "user"]}>
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireRoles={["admin", "principal", "teacher"]}>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/teacher" element={
              <ProtectedRoute requireRoles={["admin", "principal", "teacher"]}>
                <TeacherPortal />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute requireRoles={["admin", "principal"]}>
                <NotificationDemo />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute requireRoles={["admin", "principal", "teacher", "user"]}>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/features" element={
              <ProtectedRoute requireRoles={["admin", "principal", "teacher", "user"]}>
                <Features />
              </ProtectedRoute>
            } />
            <Route path="/gate" element={
              <ProtectedRoute requireRoles={["admin", "principal", "teacher"]}>
                <GateMode />
              </ProtectedRoute>
            } />
            <Route path="/parent" element={<ParentPortal />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/data" element={
              <ProtectedRoute requireRoles={["admin"]}>
                <DataBackup />
              </ProtectedRoute>
            } />
            <Route path="/__admin/face-model-validator" element={
              <ProtectedRoute requireRoles={["admin"]}>
                <FaceModelValidator />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </Suspense>
  );
}

function App() {
  const [mountNonCritical, setMountNonCritical] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const chunkRecoveryKey = "presence:chunk-recovery";

  useEffect(() => {
    const onPreloadError = (event: Event) => {
      event.preventDefault();

      const alreadyRecovered = sessionStorage.getItem(chunkRecoveryKey) === "1";
      if (alreadyRecovered) return;

      sessionStorage.setItem(chunkRecoveryKey, "1");

      void (async () => {
        try {
          if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
          }

          if ("caches" in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
          }
        } catch (err) {
          console.warn("Chunk recovery cleanup failed", err);
        } finally {
          window.location.reload();
        }
      })();
    };

    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, [chunkRecoveryKey]);

  useEffect(() => {
    sessionStorage.removeItem(chunkRecoveryKey);
  }, [chunkRecoveryKey]);

  useEffect(() => {
    const schedule = window.setTimeout(() => setMountNonCritical(true), 350);
    return () => {
      window.clearTimeout(schedule);
    };
  }, []);

  useEffect(() => {
    if (!mountNonCritical) return;

    const prefetchTimer = window.setTimeout(() => {
      void import('./pages/Attendance').catch(() => undefined);
      void import('./pages/GateMode').catch(() => undefined);
      void import('./components/gate/GateModeScanner').catch(() => undefined);
      void import('./components/attendance/FuturisticFaceScanner').catch(() => undefined);

      if (!areGateDetectionModelsLoaded()) {
        void loadGateDetectionModels().catch((err) => {
          console.warn('Gate model preload failed, will retry on Gate Mode open', err);
        });
      }
    }, 500);

    return () => window.clearTimeout(prefetchTimer);
  }, [mountNonCritical]);

  useEffect(() => {
    const splashSeen = sessionStorage.getItem('presence:splash-seen');
    if (splashSeen) {
      setShowSplash(false);
    }
  }, []);

  useEffect(() => {
    if (!showSplash) return;

    const failSafeTimer = window.setTimeout(() => {
      setShowSplash(false);
    }, 6000);

    return () => window.clearTimeout(failSafeTimer);
  }, [showSplash]);

  const handleSplashComplete = () => {
    sessionStorage.setItem('presence:splash-seen', '1');
    setShowSplash(false);
  };

  return (
    <ThemeProvider defaultTheme="light">
      <AttendanceProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            
            <HelmetProvider>
              <div className="premium-glass-app">
                <BrowserRouter>
                  {showSplash ? (
                    <SplashAnimation onComplete={handleSplashComplete} duration={2200} />
                  ) : (
                    <NotificationPermissionGate>
                      <MobileAppShell>
                        <SeoHead />
                        <AnimatedRoutes />
                      </MobileAppShell>
                      {mountNonCritical && (
                        <>
                          <AppExperienceLayer />
                          <PWAInstallPrompt />
                        </>
                      )}
                      <EmergencyAlertListener />
                      <RealtimeNotificationListener />
                    </NotificationPermissionGate>
                  )}
                </BrowserRouter>
              </div>
            </HelmetProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AttendanceProvider>
    </ThemeProvider>
  );
}

export default App;

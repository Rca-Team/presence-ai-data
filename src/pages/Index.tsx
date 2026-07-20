import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import gauravPhoto from '@/assets/gaurav-photo.png';
import swamiAnantVyasPhoto from '@/assets/swami-anant-vyas.png.asset.json';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import PageLayout from '@/components/layouts/PageLayout';
import PageTransition from '@/components/PageTransition';
import {
  ArrowRight,
  Scan,
  BookOpen,
  Shield,
  Bell,
  BarChart3,
  Bus,
  Sparkles,
  Zap,
  Brain,
  Smartphone,
  Users,
  Camera,
  Clock,
  DoorOpen,
  CalendarDays,
  UserCheck,
  ClipboardList,
  GraduationCap,
  Layers,
  Fingerprint,
  Award,
  Heart,
  AlertTriangle,
  MapPin,
  Lock,
  MessageSquare,
  Globe,
  FileText,
  Building2,
} from 'lucide-react';

const cardTilt = {
  whileHover: { rotateX: -4, rotateY: 5, y: -8, scale: 1.01 },
  transition: { type: 'spring', stiffness: 260, damping: 20 },
};

const Index = () => {
  const [activeProfile, setActiveProfile] = useState<null | {
    name: string;
    role: string;
    image?: string;
    bio: string;
    details?: string;
  }>(null);

  const modules = [
    { icon: Scan, label: 'Attendance', tone: 'bg-primary/20 text-primary' },
    { icon: BookOpen, label: 'Timetable', tone: 'bg-accent/30 text-accent-foreground' },
    { icon: Shield, label: 'Security', tone: 'bg-warning/20 text-warning-foreground' },
    { icon: Bell, label: 'Alerts', tone: 'bg-success/20 text-success' },
    { icon: BarChart3, label: 'Analytics', tone: 'bg-primary/20 text-primary' },
    { icon: Bus, label: 'Transport', tone: 'bg-accent/30 text-accent-foreground' },
  ];

  const stats = [
    { value: '99.9%', label: 'Attendance accuracy', glow: 'from-[#6c5ce7] to-[#e84393]' },
    { value: '<1s', label: 'Face scan speed', glow: 'from-[#ff6b35] to-[#f7931e]' },
    { value: '1000+', label: 'Bulk registrations', glow: 'from-[#e84393] to-[#6c5ce7]' },
    { value: '24/7', label: 'Campus monitoring', glow: 'from-[#f7931e] to-[#ff6b35]' },
  ];

  const featureCategories = [
    {
      category: 'AI-Powered Attendance',
      icon: Scan,
      gradient: 'from-[#6c5ce7] to-[#e84393]',
      features: [
        { icon: Camera, title: 'Face Recognition', desc: 'Millisecond facial detection with high precision.' },
        { icon: Users, title: 'Multi-Face Scanning', desc: 'Recognize multiple students at once in live gate flow.' },
        { icon: DoorOpen, title: 'Gate Mode', desc: 'Kiosk-ready scanning with stranger detection.' },
        { icon: Clock, title: 'Auto Cutoff Alerts', desc: 'Absence notifications sent after daily cutoff.' },
      ],
    },
    {
      category: 'Timetable & Teachers',
      icon: BookOpen,
      gradient: 'from-[#ff6b35] to-[#f7931e]',
      features: [
        { icon: CalendarDays, title: 'Smart Timetable', desc: 'Structured timetable management for all classes.' },
        { icon: UserCheck, title: 'Auto Substitution', desc: 'Automatic replacement when a teacher is absent.' },
        { icon: ClipboardList, title: 'Teacher Permissions', desc: 'Granular class-section access controls.' },
        { icon: FileText, title: 'Substitution Reports', desc: 'Printable and shareable daily reports.' },
      ],
    },
    {
      category: 'Student Management',
      icon: GraduationCap,
      gradient: 'from-[#e84393] to-[#6c5ce7]',
      features: [
        { icon: Layers, title: 'Class Structure', desc: 'Organize students by classes and sections.' },
        { icon: Fingerprint, title: 'Bulk Registration', desc: 'Import and register students at scale.' },
        { icon: Award, title: 'Gamification', desc: 'Badges, points, and class leaderboards.' },
        { icon: Heart, title: 'Wellness Scores', desc: 'Track punctuality and behavioral trends.' },
      ],
    },
    {
      category: 'Safety & Security',
      icon: Shield,
      gradient: 'from-[#f7931e] to-[#ff6b35]',
      features: [
        { icon: AlertTriangle, title: 'Emergency Alerts', desc: 'Instant lockdown and fire alerts.' },
        { icon: UserCheck, title: 'Visitor Management', desc: 'Visitor face verification and QR pass flow.' },
        { icon: MapPin, title: 'Zone Monitoring', desc: 'Track restricted areas with alerts.' },
        { icon: Lock, title: 'Stranger Detection', desc: 'Unknown face detection at entry points.' },
      ],
    },
    {
      category: 'Parent & Communication',
      icon: MessageSquare,
      gradient: 'from-[#6c5ce7] to-[#ff6b35]',
      features: [
        { icon: Bell, title: 'Smart Notifications', desc: 'Targeted alerts through preferred channels.' },
        { icon: Globe, title: 'Parent Portal', desc: 'Attendance, circulars, and performance access.' },
        { icon: FileText, title: 'Digital Circulars', desc: 'Broadcast updates with acknowledgement trail.' },
        { icon: Bus, title: 'Bus Tracking', desc: 'Boarding and route notifications to guardians.' },
      ],
    },
    {
      category: 'Analytics & Reports',
      icon: BarChart3,
      gradient: 'from-[#e84393] to-[#f7931e]',
      features: [
        { icon: Brain, title: 'AI Insights', desc: 'Predictive analysis for attendance risk.' },
        { icon: BarChart3, title: 'Advanced Reports', desc: 'Class-level and student-level reporting.' },
        { icon: Building2, title: 'Principal Dashboard', desc: 'Real-time school-wide command center.' },
        { icon: CalendarDays, title: 'Holiday Calendar', desc: 'Academic calendar with schedule context.' },
      ],
    },
  ];

  const creatorMembers = [
    {
      name: 'Gaurav',
      role: 'Developer & Team Leader',
      image: gauravPhoto,
      bio: 'Creator of Presence Smart School automation. I build scalable attendance, security, and school workflow systems with a focus on speed, clarity, and real-time reliability.',
      details: 'Full-stack engineer focused on face-recognition workflows, realtime school operations, and production-ready education systems.',
    },
    {
      name: 'Swami Anant Vyas',
      role: 'Hardware Prototype & Software Feedback Contributor',
      image: swamiAnantVyasPhoto.url,
      bio: 'Helped build the hardware prototype and contributed feedback and ideas for the software experience.',
      details: 'Built and validated early hardware concepts for gate mode and supported practical software refinements.',
    },
    {
      name: 'Jatin Dhama',
      role: 'Team Member',
      bio: 'Contributes to system testing, execution support, and project coordination for stable real-world rollouts.',
      details: 'Supports feature QA, field readiness checks, and collaborative delivery of school automation workflows.',
    },
  ];

  return (
    <PageTransition>
      <PageLayout className="neon-liquid-bg overflow-hidden has-bottom-nav md:pb-0">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 -left-24 h-80 w-80 rounded-full bg-primary/30 blur-[110px]" />
          <div className="absolute bottom-1/4 -right-20 h-80 w-80 rounded-full bg-accent/25 blur-[110px]" />
          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-warning/20 blur-[160px]" />
        </div>

        <section className="pt-2 pb-10 sm:pb-14">
          <div className="grid grid-cols-12 gap-6">
            <motion.div
              className="liquid-glass-surface liquid-glass-highlight col-span-12 rounded-3xl p-8 md:p-14 lg:col-span-7"
              style={{ perspective: 900, transformStyle: 'preserve-3d' }}
              {...cardTilt}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/55 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Complete School Automation
              </div>

              <h1
                className="mt-6 text-5xl font-extrabold leading-[1.05] text-foreground md:text-7xl"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                Your School,
                <br />
                <span className="text-gradient-neon">
                  Fully Automated
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Face-recognition attendance, timetable, gate security, parent portal & AI analytics — one platform.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/signup">
                  <Button className="h-14 rounded-2xl bg-primary px-8 text-base font-bold text-primary-foreground shadow-xl shadow-primary/30 hover:bg-primary/90">
                    Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/parent">
                  <Button variant="outline" className="h-14 rounded-2xl border-border/70 bg-card/55 px-8 text-base font-bold text-foreground hover:bg-card/80">
                    Parent Portal
                  </Button>
                </Link>
                <ThemeToggle className="h-14 w-14 rounded-2xl border-border/70 bg-card/55 hover:bg-card/80" />
              </div>
            </motion.div>

            <div className="col-span-12 grid grid-cols-2 gap-6 lg:col-span-5 lg:grid-rows-2">
              <motion.div
                className="liquid-glass-surface col-span-2 rounded-3xl p-8"
                style={{ perspective: 900, transformStyle: 'preserve-3d' }}
                {...cardTilt}
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">System Modules</span>
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-warning/70" />
                    <div className="h-2 w-2 rounded-full bg-accent/70" />
                    <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.9)]" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {modules.map((mod) => (
                    <motion.div
                      key={mod.label}
                      className="rounded-2xl border border-border/60 bg-card/55 p-4 text-center"
                      whileHover={{ rotateX: -5, rotateY: 7, y: -4 }}
                      transition={{ duration: 0.2 }}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${mod.tone}`}>
                        <mod.icon className="h-5 w-5" />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{mod.label}</p>
                    </motion.div>
                  ))}
                </div>
                <p className="mt-8 text-center text-xs font-bold tracking-widest text-primary">ALL SYSTEMS OPERATIONAL</p>
              </motion.div>

              <motion.div
                className="liquid-glass-surface rounded-3xl p-8"
                style={{ perspective: 900, transformStyle: 'preserve-3d' }}
                {...cardTilt}
              >
                <Zap className="h-8 w-8 text-warning" />
                <p className="mt-14 text-4xl font-black text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>2.4k</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Daily Students</p>
              </motion.div>

              <motion.div
                className="liquid-glass-surface rounded-3xl p-8"
                style={{ perspective: 900, transformStyle: 'preserve-3d' }}
                {...cardTilt}
              >
                <button type="button" onClick={() => setActiveProfile(creatorMembers[0])} className="group block w-full text-left" aria-label="Open Gaurav portfolio">
                  <div className="flex items-center gap-3">
                    <img src={gauravPhoto} alt="Gaurav" className="h-11 w-11 rounded-full border border-border/70 object-cover" loading="lazy" />
                  </div>
                  <p className="mt-8 text-lg font-bold text-foreground transition-colors group-hover:text-primary">Developed by Gaurav</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tap to view portfolio</p>
                </button>

                <div className="mt-4 space-y-2">
                  {creatorMembers.slice(1).map((member) => (
                    <button
                      key={member.name}
                      type="button"
                      onClick={() => setActiveProfile(member)}
                      className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/45 px-3 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={`Open ${member.name} profile`}
                    >
                      <span>Team Member: {member.name}</span>
                      {member.image ? (
                        <img
                          src={member.image}
                          alt={member.name}
                          className="h-6 w-6 rounded-full border border-border/60 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-primary/10 text-[10px] font-bold text-primary">
                          {member.name.slice(0, 1)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="pb-14">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                  className="liquid-glass-surface rounded-2xl p-5 text-center"
                style={{ perspective: 900, transformStyle: 'preserve-3d' }}
                {...cardTilt}
              >
                  <p className="text-gradient-neon text-3xl font-black md:text-5xl" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {stat.value}
                </p>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground md:text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {featureCategories.map((cat) => (
          <section key={cat.category} className="pb-14">
            <div className="mb-6 flex items-center gap-3">
              <div className="inline-flex rounded-2xl bg-primary/15 p-3 text-primary">
                <cat.icon className="h-5 w-5" />
              </div>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl" style={{ fontFamily: 'Sora, sans-serif' }}>{cat.category}</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {cat.features.map((feature) => (
                <motion.div
                  key={feature.title}
                  className="liquid-glass-surface liquid-glass-highlight group relative overflow-hidden rounded-2xl p-5"
                  style={{ perspective: 900, transformStyle: 'preserve-3d' }}
                  whileHover={{ rotateX: -4, rotateY: 6, y: -8 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary via-accent to-warning" />
                  <div className="mb-4 inline-flex rounded-2xl bg-primary/15 p-3 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground md:text-base">{feature.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground md:text-sm">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>
        ))}

        <section className="pb-10">
          <motion.div
            className="liquid-glass-surface relative overflow-hidden rounded-3xl p-8 md:p-14"
            style={{ perspective: 900, transformStyle: 'preserve-3d' }}
            {...cardTilt}
          >
            <div className="relative z-10 text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Smartphone className="h-4 w-4" /> Smart School Platform
              </p>
              <h2 className="text-3xl font-black text-foreground md:text-5xl" style={{ fontFamily: 'Sora, sans-serif' }}>Ready to Automate Your School?</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-lg">
                Attendance, timetable, security, communication and analytics in one bright, powerful system.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/signup">
                  <Button className="h-14 rounded-2xl bg-primary px-8 text-base font-bold text-primary-foreground hover:bg-primary/90">
                    Get Started — It's Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="outline" className="h-14 rounded-2xl border-border/70 bg-card/55 px-8 text-base font-bold text-foreground hover:bg-card/80">
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        <Dialog open={Boolean(activeProfile)} onOpenChange={(open) => !open && setActiveProfile(null)}>
          <DialogContent className="max-w-md rounded-2xl border-border/70 bg-card/95 p-0 backdrop-blur-xl">
            {activeProfile && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="p-6"
              >
                <DialogHeader className="space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    {activeProfile.image ? (
                      <img src={activeProfile.image} alt={activeProfile.name} className="h-16 w-16 rounded-xl border border-border/60 object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
                        {activeProfile.name.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <DialogTitle className="text-xl">{activeProfile.name}</DialogTitle>
                      <p className="text-sm text-muted-foreground">{activeProfile.role}</p>
                    </div>
                  </div>
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    {activeProfile.bio}
                  </DialogDescription>
                  {activeProfile.details ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">{activeProfile.details}</p>
                  ) : null}
                  {activeProfile.name === 'Gaurav' ? (
                    <Link
                      to="/portfolio"
                      className="inline-flex w-fit items-center gap-2 rounded-lg border border-border/60 bg-card/55 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-card"
                    >
                      Open secure portfolio
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </DialogHeader>
              </motion.div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </PageTransition>
  );
};

export default Index;

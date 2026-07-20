import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from '@/components/layouts/PageLayout';
import PageTransition from '@/components/PageTransition';
import AdminFacesList from '@/components/admin/AdminFacesList';
import AttendanceCalendar from '@/components/admin/AttendanceCalendar';
import AttendanceCutoffSetting from '@/components/admin/AttendanceCutoffSetting';
import FaceModelUpgradeSettings from '@/components/admin/FaceModelUpgradeSettings';
import AutoNotificationScheduler from '@/components/admin/AutoNotificationScheduler';
import PilotModeSettings from '@/components/admin/PilotModeSettings';
import NotificationSettings from '@/components/admin/NotificationSettings';
import BulkNotificationService from '@/components/admin/BulkNotificationService';
import CategoryBasedView from '@/components/admin/CategoryBasedView';
import PrincipalDashboard from '@/components/admin/PrincipalDashboard';
import TeacherDashboard from '@/components/admin/TeacherDashboard';
import AttendanceExport from '@/components/admin/AttendanceExport';
import AdminNotificationSender from '@/components/admin/AdminNotificationSender';
import UserAccessManager from '@/components/admin/UserAccessManager';
import BatchIDCardExtractor from '@/components/admin/BatchIDCardExtractor';
import StudentIDCardGenerator from '@/components/admin/StudentIDCardGenerator';
import StudentDetailsTable from '@/components/admin/StudentDetailsTable';
import AttendanceReportGenerator from '@/components/admin/AttendanceReportGenerator';
import ClassSectionReport from '@/components/admin/ClassSectionReport';
import SubstitutionReport from '@/components/admin/SubstitutionReport';
import EmergencyAlertPanel from '@/components/admin/EmergencyAlertPanel';
import NotificationLog from '@/components/admin/NotificationLog';
import AdminInbox from '@/components/admin/AdminInbox';
import AdminTutorial from '@/components/admin/AdminTutorial';
import StudentFaceSamplesManager from '@/components/admin/StudentFaceSamplesManager';
import FaceSamplesDiagnosticsPanel from '@/components/admin/FaceSamplesDiagnosticsPanel';
import DataBackup from '@/pages/DataBackup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  User, Calendar, Clock, FolderKanban, School,
  LayoutDashboard, Settings, Bell, Users, BarChart3,
  Shield, Activity, TrendingUp, ChevronRight, Send, UserCog,
  CreditCard, Image, Download, RefreshCw, MessageSquareText, Mail, Siren, CalendarDays, DatabaseBackup } from
'lucide-react';
import TimetableManager from '@/components/admin/TimetableManager';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { fetchUnifiedStudentSnapshot } from '@/utils/attendanceStatsHelper';

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  group: string;
  badge?: string;
  count?: number;
}

const AdminContentSkeleton = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="premium-skeleton h-16 rounded-xl" />
      ))}
    </div>
    <div className="premium-skeleton h-12 rounded-xl" />
    <div className="premium-skeleton h-[360px] md:h-[460px] rounded-2xl" />
  </div>
);

const TabPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 12, scale: 0.99 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.99 }}
    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    className={cn("space-y-4", className)}
  >
    {children}
  </motion.div>
);

const Admin = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { trigger: haptic } = useHapticFeedback();
  const { role, isLoading: isRoleLoading, isAdminOrPrincipal, isTeacher } = useUserRole();
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('');
  const [attendanceUpdated, setAttendanceUpdated] = useState(false);
  const [nameFilter, setNameFilter] = useState<string>('all');
  const [availableFaces, setAvailableFaces] = useState<{id: string; user_id?: string; name: string; employee_id: string;}[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);
  const [stats, setStats] = useState({
    totalFaces: 0,
    todayAttendance: 0,
    presentToday: 0,
    lateToday: 0
  });

  useEffect(() => {
    if (!isRoleLoading && !activeTab) {
      setActiveTab(isTeacher && !isAdminOrPrincipal ? 'teacher' : 'dashboard');
    }
  }, [isRoleLoading, isTeacher, isAdminOrPrincipal, activeTab]);

  const fetchData = useCallback(async () => {
    if (!isAdminOrPrincipal) return;
    setIsDataLoading(true);
    try {
      // Registered users: attendance_records with status='registered' is the canonical source
      const { data: faceData } = await supabase
        .from('attendance_records')
        .select('id, user_id, device_info, image_url, category')
        .eq('status', 'registered');

      const processedFaces = (faceData || []).map(r => {
        const m = (r.device_info as any)?.metadata || {};
        const name = m.name || (r.device_info as any)?.name || '';
        const employeeId = m.employee_id || (r.device_info as any)?.employee_id || '';
        return { id: r.id, user_id: r.user_id || undefined, name, employee_id: employeeId, category: r.category || 'A' };
      }).filter(u => u.name && u.name !== 'Unknown' && u.name !== 'User');

      // Deduplicate by employee_id
      const seenIds = new Set<string>();
      const uniqueFaces = processedFaces.filter(u => {
        const key = u.employee_id || u.user_id || u.id;
        if (!key || seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      });
      setAvailableFaces(uniqueFaces);

      const unified = await fetchUnifiedStudentSnapshot();

      setStats({
        totalFaces: unified.totalRegistered,
        todayAttendance: unified.presentToday + unified.lateToday,
        presentToday: unified.presentToday,
        lateToday: unified.lateToday,
      });

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      setNotificationCount(count || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsDataLoading(false);
    }
  }, [isAdminOrPrincipal]);

  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      fetchData();
      refreshTimerRef.current = null;
    }, 300);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const channel = supabase.
    channel('admin-dashboard').
    on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
      setAttendanceUpdated(true);
      haptic('medium');
      queueRefresh();
    }).
    on('postgres_changes', { event: '*', schema: 'public', table: 'gate_entries' }, () => {
      setAttendanceUpdated(true);
      haptic('medium');
      queueRefresh();
    }).
    on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => queueRefresh()).
    subscribe();
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [fetchData, haptic, queueRefresh]);

  useEffect(() => {
    if (attendanceUpdated) {
      const timer = setTimeout(() => setAttendanceUpdated(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [attendanceUpdated]);

  const handleTabChange = (tab: string) => {
    haptic('selection');
    setActiveTab(tab);
  };

  const handleRefresh = async () => {
    await fetchData();
    toast({ title: "Refreshed", description: "Data updated." });
  };

  if (isRoleLoading) {
    return (
      <PageTransition>
        <PageLayout className="min-h-screen bg-background">
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </PageLayout>
      </PageTransition>);

  }

  if (isTeacher && !isAdminOrPrincipal) {
    return (
      <PageTransition>
        <PageLayout className="min-h-screen bg-background">
          <TeacherDashboard />
        </PageLayout>
      </PageTransition>);

  }

  const navItems: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'Overview' },
  { id: 'sections', icon: FolderKanban, label: 'Class', group: 'Overview' },
  { id: 'students', icon: Users, label: 'Students', group: 'Overview', badge: attendanceUpdated ? 'new' : undefined },
  { id: 'calendar', icon: Calendar, label: 'Calendar', group: 'Overview' },
  { id: 'idcard', icon: Image, label: 'ID Extract', group: 'Registration' },
  { id: 'idcards', icon: CreditCard, label: 'ID Cards', group: 'Registration' },
  { id: 'reports', icon: BarChart3, label: 'Reports', group: 'Management' },
  { id: 'access', icon: UserCog, label: 'Access', group: 'Management' },
  { id: 'notifications', icon: Bell, label: 'Notifications', group: 'Management', count: notificationCount },
  { id: 'samples', icon: Activity, label: 'Face Samples', group: 'Management' },
  { id: 'data-backup', icon: DatabaseBackup, label: 'Data Backup', group: 'Management' },
  { id: 'notif-log', icon: MessageSquareText, label: 'Delivery Log', group: 'Management' },
  { id: 'inbox', icon: Mail, label: 'Inbox', group: 'Management' },
  { id: 'emergency', icon: Siren, label: 'Emergency', group: 'Management' },
  { id: 'timetable', icon: CalendarDays, label: 'Timetable', group: 'Management' },
  { id: 'settings', icon: Settings, label: 'Settings', group: 'Management' }];


  const groups = ['Overview', 'Registration', 'Management'];

  const statsCards = [
  { label: 'Registered', value: stats.totalFaces, icon: Users, color: 'text-primary' },
  { label: 'Present', value: stats.presentToday, icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
  { label: 'Late', value: stats.lateToday, icon: Clock, color: 'text-orange-600 dark:text-orange-400' },
  { label: 'Total', value: stats.todayAttendance, icon: Activity, color: 'text-blue-600 dark:text-blue-400' }];


  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <TabPanel>
            <PrincipalDashboard />
          </TabPanel>
        );
      case 'sections':
        return (
          <TabPanel>
            <CategoryBasedView />
          </TabPanel>
        );
      case 'students':
        return (
          <TabPanel>
            <AdminFacesList
              viewMode={viewMode}
              selectedFaceId={selectedFaceId}
              nameFilter={nameFilter}
              setSelectedFaceId={(id) => {
                haptic('selection');
                setSelectedFaceId(id);
                if (id) setActiveTab('calendar');
              }} />
          </TabPanel>
        );
      case 'calendar':
        return (
          <TabPanel>
            <AttendanceCalendar selectedFaceId={selectedFaceId} />
          </TabPanel>
        );
      case 'idcard':
        return (
          <TabPanel>
            <BatchIDCardExtractor />
          </TabPanel>
        );
      case 'idcards':
        return (
          <TabPanel>
            <StudentDetailsTable />
          </TabPanel>
        );
      case 'reports':
        return (
          <TabPanel className="space-y-6">
            <SubstitutionReport />
            <ClassSectionReport />
            <AttendanceReportGenerator />
          </TabPanel>
        );
      case 'access':
        return (
          <TabPanel>
            <UserAccessManager />
          </TabPanel>
        );
      case 'notifications':
        return (
          <TabPanel>
            <AdminNotificationSender availableFaces={availableFaces} />
          </TabPanel>
        );
      case 'samples':
        return (
          <TabPanel>
            <FaceSamplesDiagnosticsPanel />
            <StudentFaceSamplesManager />
          </TabPanel>
        );
      case 'data-backup':
        return (
          <TabPanel>
            <DataBackup embedded />
          </TabPanel>
        );
      case 'notif-log':
        return (
          <TabPanel>
            <NotificationLog />
          </TabPanel>
        );
      case 'inbox':
        return (
          <TabPanel>
            <AdminInbox />
          </TabPanel>
        );
      case 'emergency':
        return (
          <TabPanel>
            <EmergencyAlertPanel />
          </TabPanel>
        );
      case 'timetable':
        return (
          <TabPanel>
            <TimetableManager />
          </TabPanel>
        );
      case 'settings':
        return (
          <TabPanel className="space-y-6">
            <AttendanceCutoffSetting />
            <PilotModeSettings />
            <NotificationSettings />
            <FaceModelUpgradeSettings />
            <AutoNotificationScheduler />
          </TabPanel>
        );
      default:
        return (
          <TabPanel>
            <PrincipalDashboard />
          </TabPanel>
        );
    }
  };

  return (
    <PageTransition>
      <PageLayout className="min-h-screen bg-background">
        <div className="flex h-[calc(100dvh-4rem)]">
          {/* Desktop Sidebar */}
          {!isMobile &&
          <aside className={cn(
            "border-r border-border bg-card flex flex-col transition-all duration-200",
            sidebarCollapsed ? "w-16" : "w-56"
          )}>
              <div className="p-3 border-b border-border flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                {!sidebarCollapsed &&
              <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">Admin</p>
                    <p className="text-[10px] text-muted-foreground">Management</p>
                  </div>
              }
              </div>

              <ScrollArea className="flex-1 py-2">
                {groups.map((group) =>
              <div key={group} className="mb-1">
                    {!sidebarCollapsed &&
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {group}
                      </p>
                }
                    {navItems.filter((n) => n.group === group).map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      data-nav-id={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                        isActive ?
                        "bg-primary/10 text-primary border-r-2 border-primary font-medium" :
                        "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      title={sidebarCollapsed ? item.label : undefined}>
                      
                          <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-primary")} />
                          {!sidebarCollapsed &&
                      <>
                              <span className="truncate flex-1 text-left">{item.label}</span>
                              {item.badge &&
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        }
                              {item.count !== undefined && item.count > 0 &&
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3.5 min-w-[14px]">
                          {item.count}
                        </Badge>
                        }
                            </>
                      }
                        </button>);

                })}
                  </div>
              )}
              </ScrollArea>

              <div className="p-2 border-t border-border space-y-1">
                <div className="flex items-center justify-between px-2">
                  <ThemeToggle />
                  <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                  
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", sidebarCollapsed && "rotate-180")} />
                  </Button>
                </div>
                {!sidebarCollapsed &&
              <div className="flex gap-1">
                    <AttendanceExport />
                    <BulkNotificationService availableFaces={availableFaces} />
                  </div>
              }
              </div>
            </aside>
          }

          {/* Main Content */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top Bar - Compact on mobile */}
            <div className="border-b border-border bg-card px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-semibold truncate">
                    {navItems.find((n) => n.id === activeTab)?.label || 'Dashboard'}
                  </h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block truncate">
                    {activeTab === 'dashboard' && 'Overview of attendance and registered students'}
                    {activeTab === 'students' && 'View and manage all registered students'}
                    {activeTab === 'reports' && 'Generate and export attendance reports'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <AdminTutorial onNavigate={handleTabChange} />
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={handleRefresh}>
                  <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                {isMobile && <ThemeToggle />}
              </div>
            </div>

            {/* Stats Bar - Scrollable on mobile */}
            <div className="border-b border-border bg-card/50 px-3 sm:px-4 py-1.5 sm:py-2">
              <div className="flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
                {statsCards.map((stat, i) =>
                <div key={i} className="flex items-center gap-1.5 py-0.5 min-w-fit">
                    <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                    <span className="text-sm sm:text-lg font-bold tabular-nums">{stat.value}</span>
                    <span className="text-[9px] sm:text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile feature navigation moved to top for faster access */}
            {isMobile && (
              <div className="border-b border-border bg-card px-2 py-2 sticky top-0 z-20">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <Button
                        key={item.id}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleTabChange(item.id)}
                        className="shrink-0 h-8 px-2.5 gap-1.5"
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{item.label}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <Badge variant="destructive" className="text-[8px] h-4 min-w-[14px] px-1">
                            {item.count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content Area */}
            <PullToRefresh onRefresh={handleRefresh} enabled={isMobile} className="flex-1 overflow-auto">
              <div className="p-2.5 sm:p-4 md:p-6 pb-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}>

                    {isDataLoading ? <AdminContentSkeleton /> : renderContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </PullToRefresh>
          </main>
        </div>

      </PageLayout>
    </PageTransition>);

};

export default Admin;
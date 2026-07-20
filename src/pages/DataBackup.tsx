import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/layouts/PageLayout';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { DatabaseBackup, Upload, Trash2, ShieldAlert, Loader2, RotateCcw, History } from 'lucide-react';

type BackupResponse = {
  backup: unknown;
  warnings?: string[];
  stats?: {
    users?: number;
    tables?: number;
    storageFiles?: number;
    partial?: boolean;
  };
};

type LocalSnapshot = {
  id: string;
  label: string;
  createdAt: string;
  triggerType: 'manual' | 'auto' | 'rollback';
  backup: unknown;
  stats?: BackupResponse['stats'];
};

const SNAPSHOT_STORAGE_KEY = 'project_backup_snapshots_v1';
const MAX_LOCAL_SNAPSHOTS = 20;
const RELIABLE_EXPORT_OPTIONS = {
  action: 'export_backup' as const,
  fastMode: true,
  includeStorage: false,
  includeAuthUsers: false,
  includeFaceDescriptors: false,
  maxAuthUsers: 0,
  maxTableRows: 500,
  maxTotalRows: 2400,
  maxTables: 12,
};
const FALLBACK_EXPORT_OPTIONS = {
  ...RELIABLE_EXPORT_OPTIONS,
  maxTableRows: 250,
  maxTotalRows: 1200,
  maxTables: 8,
};

type OperationPhase = {
  action: 'export' | 'snapshot' | 'restore' | 'rollback' | 'cleanup' | null;
  label: string;
  progress: number;
  status: 'idle' | 'running' | 'done' | 'failed';
};

const DataBackup = ({ embedded = false }: { embedded?: boolean }) => {
  const { toast } = useToast();
  const { role, isLoading } = useUserRole();
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [includeAuthUsers, setIncludeAuthUsers] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [operationPhase, setOperationPhase] = useState<OperationPhase>({
    action: null,
    label: '',
    progress: 0,
    status: 'idle',
  });

  const canRunCleanup = useMemo(() => confirmationCode.trim() === 'CLEAN MY CLOUD', [confirmationCode]);
  const latestRollbackPoint = useMemo(
    () => snapshots.find((item) => item.triggerType === 'rollback') || snapshots[0],
    [snapshots],
  );

  const persistSnapshots = (next: LocalSnapshot[]) => {
    setSnapshots(next);
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
  };

  const pushSnapshot = (snapshot: LocalSnapshot) => {
    setSnapshots((prev) => {
      const next = [snapshot, ...prev].slice(0, MAX_LOCAL_SNAPSHOTS);
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as LocalSnapshot[];
      if (Array.isArray(parsed)) {
        setSnapshots(parsed);
      }
    } catch {
      setSnapshots([]);
    }
  }, []);

  useEffect(() => {
    const runAutoDailySnapshot = async () => {
      if (isLoading || role !== 'admin') return;
      const today = new Date().toISOString().slice(0, 10);
      const hasTodayAuto = snapshots.some(
        (item) => item.triggerType === 'auto' && item.createdAt.slice(0, 10) === today,
      );
      if (hasTodayAuto) return;

      try {
        const result = await invokeExportWithFallback();
        const typedData = result.data;

        const autoSnapshot: LocalSnapshot = {
          id: crypto.randomUUID(),
          label: `Auto Daily ${today}`,
          createdAt: new Date().toISOString(),
          triggerType: 'auto',
          backup: typedData.backup,
          stats: typedData.stats,
        };

        const next = [autoSnapshot, ...snapshots].slice(0, MAX_LOCAL_SNAPSHOTS);
        persistSnapshots(next);
      } catch {
        // non-blocking auto snapshot
      }
    };

    void runAutoDailySnapshot();
  }, [isLoading, role, snapshots]);

  const beginOperation = (action: NonNullable<OperationPhase['action']>, label: string) => {
    setOperationPhase({ action, label, progress: 8, status: 'running' });
  };

  const finishOperation = (status: 'done' | 'failed', label: string) => {
    setOperationPhase((prev) => ({
      ...prev,
      label,
      progress: 100,
      status,
    }));
  };

  useEffect(() => {
    if (operationPhase.status !== 'running') return;

    const timer = setInterval(() => {
      setOperationPhase((prev) => {
        if (prev.status !== 'running') return prev;
        return {
          ...prev,
          progress: Math.min(prev.progress + 7, 92),
        };
      });
    }, 850);

    return () => clearInterval(timer);
  }, [operationPhase.status]);

  const downloadJsonFile = (fileName: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const invokeExportWithFallback = async () => {
    const firstTry = await supabase.functions.invoke('project-backup-manager', {
      body: RELIABLE_EXPORT_OPTIONS,
    });

    const firstData = firstTry.data as BackupResponse | null;
    if (!firstTry.error && firstData?.backup) {
      return { data: firstData, usedFallback: false };
    }

    const firstErrorMessage = firstTry.error?.message?.toLowerCase() || '';
    const shouldFallback =
      firstErrorMessage.includes('timeout') ||
      firstErrorMessage.includes('idle timeout') ||
      firstErrorMessage.includes('operation timed out');

    if (!shouldFallback) {
      throw new Error(firstTry.error?.message || 'Failed to generate backup');
    }

    const fallbackTry = await supabase.functions.invoke('project-backup-manager', {
      body: FALLBACK_EXPORT_OPTIONS,
    });

    const fallbackData = fallbackTry.data as BackupResponse | null;
    if (fallbackTry.error || !fallbackData?.backup) {
      throw new Error(fallbackTry.error?.message || firstTry.error?.message || 'Failed to generate backup');
    }

    return { data: fallbackData, usedFallback: true };
  };

  const handleExport = async () => {
    try {
      beginOperation('export', 'Preparing full backup...');
      setIsExporting(true);
      const result = await invokeExportWithFallback();
      const typedData = result.data;

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJsonFile(`project-backup-${stamp}.json`, typedData.backup);

      toast({
        title: 'Backup created',
        description: result.usedFallback
          ? `Backup completed in safe mode with ${typedData.stats?.tables ?? 0} tables.`
          : `Downloaded backup with ${typedData.stats?.users ?? 0} users and ${typedData.stats?.tables ?? 0} tables.`,
      });
      finishOperation('done', 'Backup completed.');
    } catch (err: any) {
      toast({
        title: 'Backup failed',
        description: err?.message || 'Could not create backup file.',
        variant: 'destructive',
      });
      finishOperation('failed', 'Backup failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      beginOperation('snapshot', 'Creating rollback snapshot...');
      setIsSnapshotting(true);
      const result = await invokeExportWithFallback();
      const typedData = result.data;

      pushSnapshot({
        id: crypto.randomUUID(),
        label: `Manual Snapshot ${new Date().toLocaleString()}`,
        createdAt: new Date().toISOString(),
        triggerType: 'manual',
        backup: typedData.backup,
        stats: typedData.stats,
      });

      toast({
        title: 'Snapshot created',
        description: result.usedFallback ? 'Manual rollback point saved in safe mode.' : 'Manual rollback point saved.',
      });
      finishOperation('done', 'Snapshot completed.');
    } catch (err: any) {
      toast({
        title: 'Snapshot failed',
        description: err?.message || 'Could not create rollback snapshot.',
        variant: 'destructive',
      });
      finishOperation('failed', 'Snapshot failed.');
    } finally {
      setIsSnapshotting(false);
    }
  };

  const restoreFromSnapshot = async (snapshot: LocalSnapshot) => {
    const { error } = await supabase.functions.invoke('project-backup-manager', {
      body: { action: 'restore_backup', backup: snapshot.backup },
    });
    if (error) throw new Error(error.message);
  };

  const handleRollbackNow = async () => {
    if (!latestRollbackPoint) {
      toast({
        title: 'No rollback point',
        description: 'Create a snapshot first or restore a backup file once.',
        variant: 'destructive',
      });
      return;
    }

    try {
      beginOperation('rollback', 'Applying rollback snapshot...');
      setIsRollingBack(true);
      await restoreFromSnapshot(latestRollbackPoint);
      toast({
        title: 'Rollback completed',
        description: `Restored: ${latestRollbackPoint.label}`,
      });
      finishOperation('done', 'Rollback completed.');
    } catch (err: any) {
      toast({
        title: 'Rollback failed',
        description: err?.message || 'Could not rollback to selected snapshot.',
        variant: 'destructive',
      });
      finishOperation('failed', 'Rollback failed.');
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleRestore = async () => {
    if (!backupFile) {
      toast({ title: 'No file selected', description: 'Upload a backup .json file first.', variant: 'destructive' });
      return;
    }

    try {
      beginOperation('restore', 'Creating pre-restore rollback point...');
      setIsRestoring(true);

      // Always create rollback point before applying incoming backup
      const preRestore = await invokeExportWithFallback().catch(() => null);
      const preRestoreData = preRestore?.data;
      if (preRestoreData?.backup) {
        pushSnapshot({
          id: crypto.randomUUID(),
          label: `Rollback Point ${new Date().toLocaleString()}`,
          createdAt: new Date().toISOString(),
          triggerType: 'rollback',
          backup: preRestoreData.backup,
          stats: preRestoreData.stats,
        });
      }

      const raw = await backupFile.text();
      const parsed = JSON.parse(raw);
      setOperationPhase((prev) => ({ ...prev, label: 'Restoring backup data into cloud...' }));

      const { error } = await supabase.functions.invoke('project-backup-manager', {
        body: { action: 'restore_backup', backup: parsed },
      });

      if (error) throw new Error(error.message);

      toast({
        title: 'Restore completed',
        description: 'Backup restored. A rollback point was saved automatically.',
      });
      finishOperation('done', 'Restore completed.');
    } catch (err: any) {
      toast({
        title: 'Restore failed',
        description: err?.message || 'Backup file is invalid or restore failed.',
        variant: 'destructive',
      });
      finishOperation('failed', 'Restore failed.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreStoredSnapshot = async (snapshot: LocalSnapshot) => {
    try {
      beginOperation('restore', `Restoring snapshot: ${snapshot.label}`);
      setIsRestoring(true);
      await restoreFromSnapshot(snapshot);
      toast({
        title: 'Restore completed',
        description: `Restored from snapshot: ${snapshot.label}`,
      });
      finishOperation('done', 'Restore completed.');
    } catch (err: any) {
      toast({
        title: 'Restore failed',
        description: err?.message || 'Could not restore selected snapshot.',
        variant: 'destructive',
      });
      finishOperation('failed', 'Restore failed.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCleanCloud = async () => {
    if (!canRunCleanup) {
      toast({
        title: 'Confirmation needed',
        description: 'Type CLEAN MY CLOUD to unlock full cleanup.',
        variant: 'destructive',
      });
      return;
    }

    try {
      beginOperation('cleanup', 'Cleaning cloud tables and storage...');
      setIsCleaning(true);
      const { error } = await supabase.functions.invoke('project-backup-manager', {
        body: {
          action: 'clean_cloud',
          confirmationCode,
          includeAuthUsers,
        },
      });

      if (error) throw new Error(error.message);

      toast({
        title: 'Cloud cleaned',
        description: 'All project data and face files were removed successfully.',
      });
      finishOperation('done', 'Cloud cleanup completed.');

      setBackupFile(null);
      setSelectedFileName('');
      setConfirmationCode('');
    } catch (err: any) {
      toast({
        title: 'Cleanup failed',
        description: err?.message || 'Could not clean cloud data.',
        variant: 'destructive',
      });
      finishOperation('failed', 'Cloud cleanup failed.');
    } finally {
      setIsCleaning(false);
    }
  };

  if (isLoading) {
    if (embedded) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <PageTransition>
        <PageLayout>
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageLayout>
      </PageTransition>
    );
  }

  if (role !== 'admin') {
    if (embedded) {
      return (
        <div className="mx-auto max-w-xl py-10">
          <Alert variant="destructive" className="border-destructive/50">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              You are not authorized to access this developer data page.
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <PageTransition>
        <PageLayout>
          <div className="mx-auto max-w-xl py-10">
            <Alert variant="destructive" className="border-destructive/50">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                You are not authorized to access this developer data page.
              </AlertDescription>
            </Alert>
          </div>
        </PageLayout>
      </PageTransition>
    );
  }

  const content = (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Developer Data</h1>
          <p className="text-sm text-muted-foreground">Backup, restore, and full cloud cleanup controls.</p>
        </div>
        <Badge variant="secondary" className="gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Admin only</Badge>
      </div>

      {operationPhase.status !== 'idle' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Operation Progress</CardTitle>
            <CardDescription>{operationPhase.label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={operationPhase.progress} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="capitalize">{operationPhase.status}</span>
              <span>{Math.round(operationPhase.progress)}%</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DatabaseBackup className="h-5 w-5" /> Full Backup</CardTitle>
          <CardDescription>
            Download a full backup JSON including users, project tables, and stored face files.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
            {isExporting ? 'Preparing backup...' : 'Download Backup'}
          </Button>
          <Button onClick={handleCreateSnapshot} disabled={isSnapshotting} variant="outline" className="gap-2">
            {isSnapshotting ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
            {isSnapshotting ? 'Saving snapshot...' : 'Create Snapshot'}
          </Button>
          <Button onClick={handleRollbackNow} disabled={isRollingBack || !latestRollbackPoint} variant="secondary" className="gap-2">
            {isRollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {isRollingBack ? 'Rolling back...' : 'Rollback Latest'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Snapshot History</CardTitle>
          <CardDescription>
            Manual + daily snapshots for full-site rollback (students, images, records, and stats).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet. Create one now.</p>
          ) : (
            snapshots.slice(0, 10).map((snapshot) => (
              <div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{snapshot.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(snapshot.createdAt).toLocaleString()} • {snapshot.triggerType}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRestoring}
                  onClick={() => handleRestoreStoredSnapshot(snapshot)}
                >
                  Restore
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Restore from Backup</CardTitle>
          <CardDescription>
            Upload a previously downloaded backup JSON to restore data and face storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="backup-file">Backup file (.json)</Label>
            <Input
              id="backup-file"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setBackupFile(file);
                setSelectedFileName(file?.name || '');
              }}
            />
            {selectedFileName ? <p className="text-xs text-muted-foreground">Selected: {selectedFileName}</p> : null}
          </div>
          <Button onClick={handleRestore} disabled={isRestoring || !backupFile} className="gap-2">
            {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isRestoring ? 'Restoring...' : 'Restore Backup'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> Clean Whole Cloud</CardTitle>
          <CardDescription>
            Permanently delete all project data and all stored face files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              This action is destructive and cannot be undone without a backup file.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Also delete authentication users</p>
              <p className="text-xs text-muted-foreground">Keeps your currently logged-in account safe automatically.</p>
            </div>
            <Switch checked={includeAuthUsers} onCheckedChange={setIncludeAuthUsers} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cleanup-code">Type CLEAN MY CLOUD to confirm</Label>
            <Input
              id="cleanup-code"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="CLEAN MY CLOUD"
            />
          </div>

          <Button
            variant="destructive"
            onClick={handleCleanCloud}
            disabled={!canRunCleanup || isCleaning}
            className="gap-2"
          >
            {isCleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isCleaning ? 'Cleaning cloud...' : 'Clean Whole Cloud'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageTransition>
      <PageLayout>
        {content}
      </PageLayout>
    </PageTransition>
  );
};

export default DataBackup;
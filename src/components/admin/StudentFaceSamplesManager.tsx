import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Search, User, Scissors, RefreshCw, ImageIcon, Trash2, ArrowRightLeft, ArrowLeft, UserX } from 'lucide-react';
import ImageCropper from './ImageCropper';
import { uploadImage } from '@/services/face-recognition/StorageService';
import {
  syncFromSupabase as syncDescriptorCache,
  cacheDescriptor,
  removeFromCache,
} from '@/services/face-recognition/DescriptorCacheService';

type FaceSample = {
  id: string;
  user_id: string;
  label: string | null;
  image_url: string | null;
  created_at: string;
  source: 'descriptor_registration' | 'record_registration' | 'recognition_attendance' | 'recognition_gate';
  source_table: 'face_descriptors' | 'attendance_records';
  confidence_score?: number | null;
  status?: string | null;
};

type StudentGroup = {
  userId: string;
  name: string;
  employeeId: string;
  samples: FaceSample[];
};

const isSlot = (s: FaceSample) => s.source_table === 'face_descriptors';
const FACE_SAMPLE_BUCKETS = ['face-images', 'attendance-training-faces', 'student-registration-faces'] as const;

const parseStoragePathFromUrl = (value: string, bucket: string): string | null => {
  const cleaned = value.trim();
  const pattern = new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/([^?]+)`);
  const match = cleaned.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const toPersistentImageReference = (rawValue: string | null | undefined): string | null => {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (!value) return null;
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;

  const isStorageObjectUrl = /\/storage\/v1\/object\/(?:public|sign)\//.test(value);
  if (/^https?:\/\//i.test(value) && !isStorageObjectUrl) {
    return value;
  }

  for (const bucket of FACE_SAMPLE_BUCKETS) {
    const path = parseStoragePathFromUrl(value, bucket);
    if (!path) continue;
    return bucket === 'face-images' ? path : `${bucket}/${path}`;
  }

  const normalized = value.replace(/^\/+/, '');
  for (const bucket of FACE_SAMPLE_BUCKETS) {
    if (normalized.startsWith(`${bucket}/`)) {
      const path = normalized.slice(bucket.length + 1);
      return bucket === 'face-images' ? path : `${bucket}/${path}`;
    }
  }

  return normalized;
};

const resolveFaceSampleUrl = async (
  rawValue: string | null | undefined,
  signedUrlCache: Map<string, string | null>
): Promise<string | null> => {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (!value) return null;

  const isStorageObjectUrl = /\/storage\/v1\/object\/(?:public|sign)\//.test(value);

  if (value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  if (/^https?:\/\//i.test(value) && !isStorageObjectUrl) {
    return value;
  }

  const candidates = new Set<{ bucket: string; path: string }>();

  FACE_SAMPLE_BUCKETS.forEach((bucket) => {
    const extracted = parseStoragePathFromUrl(value, bucket);
    if (extracted) candidates.add({ bucket, path: extracted });
  });

  if (candidates.size === 0) {
    const normalized = value.replace(/^\/+/, '');
    const prefixed = FACE_SAMPLE_BUCKETS.find((bucket) => normalized.startsWith(`${bucket}/`));
    if (prefixed) {
      const path = normalized.slice(prefixed.length + 1);
      candidates.add({ bucket: prefixed, path });
    }
    FACE_SAMPLE_BUCKETS.forEach((bucket) => candidates.add({ bucket, path: normalized }));
  }

  for (const candidate of candidates) {
    const cacheKey = `${candidate.bucket}:${candidate.path}`;
    if (signedUrlCache.has(cacheKey)) {
      const cached = signedUrlCache.get(cacheKey);
      if (cached) return cached;
      continue;
    }

    const { data, error } = await supabase.storage
      .from(candidate.bucket)
      .createSignedUrl(candidate.path, 60 * 60);

    if (!error && data?.signedUrl) {
      signedUrlCache.set(cacheKey, data.signedUrl);
      return data.signedUrl;
    }

    signedUrlCache.set(cacheKey, null);
  }

  return null;
};

const StudentFaceSamplesManager: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'slots' | 'captured'>('all');

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSample, setCropSample] = useState<FaceSample | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const [transferSampleId, setTransferSampleId] = useState<string | null>(null);
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>('');
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [mergeTargetUserId, setMergeTargetUserId] = useState<string>('');
  const [mergingStudent, setMergingStudent] = useState(false);
  const [reregisteringStudent, setReregisteringStudent] = useState(false);
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());

  const isUuid = (value: string | null | undefined) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

  const fetchSamples = async () => {
    setLoading(true);
    try {
      const [samplesRes, allAttRes, profileRes] = await Promise.all([
        supabase
          .from('face_descriptors')
          .select('id, user_id, student_id, label, image_url, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('attendance_records')
          .select('id, user_id, student_id, student_name, image_url, status, device_info, timestamp, confidence_score')
          .neq('status', 'unauthorized')
          .order('timestamp', { ascending: false }),
        supabase
          .from('profiles')
          .select('user_id, display_name')
          .not('user_id', 'is', null),
      ]);

      if (samplesRes.error) throw samplesRes.error;
      if (allAttRes.error) throw allAttRes.error;
      if (profileRes.error) throw profileRes.error;

      const profileMap = new Map<string, string>();
      (profileRes.data || []).forEach((p: any) => {
        if (p?.user_id && p?.display_name) profileMap.set(p.user_id, p.display_name);
      });

      const employeeToUserId = new Map<string, string>();
      (allAttRes.data || []).forEach((r: any) => {
        const di = r.device_info || {};
        const m = di.metadata || {};
        const empKey = (m.employee_id || m.roll_number || di.employee_id || r.student_id || '').toString().trim();
        if (r.user_id && empKey) employeeToUserId.set(empKey, r.user_id);
      });

      // Build the student directory using the SAME logic as StudentDetailsTable so
      // every registered student (22) appears here even if their attendance rows
      // have a null user_id. The "key" is the stable identity used for grouping.
      const grouped = new Map<string, StudentGroup>();
      const userIdToKey = new Map<string, string>(); // map auth user_id → group key
      const employeeToKey = new Map<string, string>();

      const keyForRecord = (r: any): string | null => {
        const di = r.device_info || {};
        const m = di.metadata || {};
        const empId = (m.employee_id || m.roll_number || di.employee_id || r.student_id || '').toString().trim();
        const canonicalUserId = r.user_id || (empId ? employeeToUserId.get(empId) : null);
        // Prefer student/employee identity first so shared user_id cannot collapse students
        return (empId || canonicalUserId || r.id) as string | null;
      };

      (allAttRes.data || []).forEach((r: any) => {
        const di = r.device_info || {};
        const m = di.metadata || {};
        const name = m.name || di.name || r.student_name || (r.user_id ? profileMap.get(r.user_id) : '') || '';
        if (!name || name === 'Unknown' || name === 'User') return;
        const key = keyForRecord(r);
        if (!key) return;
        if (!grouped.has(key)) {
          grouped.set(key, {
            userId: r.user_id || key,
            name,
            employeeId: m.employee_id || m.roll_number || di.employee_id || r.student_id || key,
            samples: [],
          });
          if (r.user_id) userIdToKey.set(r.user_id, key);
          const empId = m.employee_id || m.roll_number || di.employee_id || r.student_id;
          if (empId) employeeToKey.set(empId, key);
        } else if (r.user_id && !userIdToKey.has(r.user_id)) {
          userIdToKey.set(r.user_id, key);
        }
      });

      // Push attendance-based samples (register / recognition / gate)
      (allAttRes.data || []).forEach((r: any) => {
        if (!r.image_url) return;
        const key = keyForRecord(r);
        if (!key || !grouped.has(key)) return;
        const di = r.device_info || {};
        const fromGate = Boolean(di.gate);
        let source: FaceSample['source'];
        if (r.status === 'registered' || r.status === 'pending_approval') {
          source = 'record_registration';
        } else if ((r.confidence_score ?? 0) >= 0.6 && (r.status === 'present' || r.status === 'late')) {
          source = fromGate ? 'recognition_gate' : 'recognition_attendance';
        } else {
          return;
        }
        grouped.get(key)!.samples.push({
          id: r.id,
          user_id: r.user_id || key,
          label: di.metadata?.name || null,
          image_url: r.image_url,
          created_at: r.timestamp,
          source,
          source_table: 'attendance_records',
          confidence_score: r.confidence_score ?? null,
          status: r.status,
        });
      });

      // Push trained-slot descriptors. Keep existing attendance-linked students,
      // and also include descriptor-only students so all registered faces appear.
      (samplesRes.data || []).forEach((raw: any) => {
        const uid = (raw.user_id || '').toString().trim();
        const studentId = (raw.student_id || '').toString().trim();
        const label = (raw.label || '').toString().trim();
        let key = uid ? userIdToKey.get(uid) : undefined;
        if (!key) key = uid || studentId || raw.id;
        if (!grouped.has(key)) {
          const profileName = uid ? profileMap.get(uid) : '';
          grouped.set(key, {
            userId: uid || key,
            name: label || profileName || studentId || 'Student',
            employeeId: studentId || key,
            samples: [],
          });
          if (uid) userIdToKey.set(uid, key);
        }
        grouped.get(key)!.samples.push({
          id: raw.id,
          user_id: uid || key,
          label: raw.label,
          image_url: raw.image_url,
          created_at: raw.created_at,
          source: 'descriptor_registration',
          source_table: 'face_descriptors',
          confidence_score: 1,
          status: 'registered',
        });
      });

      const next = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
      const signedUrlCache = new Map<string, string | null>();
      const hydratedGroups = await Promise.all(
        next.map(async (group) => ({
          ...group,
          samples: await Promise.all(
            group.samples.map(async (sample) => {
              const resolved = await resolveFaceSampleUrl(sample.image_url, signedUrlCache);
              return {
                ...sample,
                image_url: resolved,
              };
            })
          ),
        }))
      );

      setGroups(hydratedGroups);
      if (!selectedUserId && hydratedGroups.length > 0) {
        setSelectedUserId(hydratedGroups[0].userId);
      }
    } catch (error) {
      console.error('Failed to fetch face samples:', error);
      toast({ title: 'Error', description: 'Could not load student face samples.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSamples();
    const channel = supabase
      .channel('face-samples-manager')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'face_descriptors' }, async (payload: any) => {
        const r = payload.new || {};
        try {
          if (r.descriptor && r.user_id) {
            await cacheDescriptor({
              id: r.id,
              userId: r.user_id,
              name: r.label || 'Unknown',
              descriptor: r.descriptor as number[],
              imageUrl: r.image_url,
              createdAt: new Date(r.created_at || Date.now()).getTime(),
              lastUsed: Date.now(),
            });
          } else {
            await syncDescriptorCache();
          }
          toast({ title: 'Model synced', description: `Added ${r.label || 'new descriptor'} to live model.` });
        } catch (err) {
          console.warn('Incremental cache add failed, doing full resync:', err);
          syncDescriptorCache().catch(() => {});
        }
        fetchSamples();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'face_descriptors' }, async (payload: any) => {
        const r = payload.old || {};
        try {
          if (r.id) await removeFromCache(r.id);
          toast({ title: 'Model synced', description: `Removed ${r.label || 'descriptor'} from live model.` });
        } catch (err) {
          console.warn('Incremental cache delete failed, doing full resync:', err);
          syncDescriptorCache().catch(() => {});
        }
        fetchSamples();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'face_descriptors' }, async (payload: any) => {
        const r = payload.new || {};
        try {
          if (r.descriptor && r.user_id) {
            await cacheDescriptor({
              id: r.id,
              userId: r.user_id,
              name: r.label || 'Unknown',
              descriptor: r.descriptor as number[],
              imageUrl: r.image_url,
              createdAt: new Date(r.created_at || Date.now()).getTime(),
              lastUsed: Date.now(),
            });
          }
          toast({ title: 'Model synced', description: 'Live model updated.' });
        } catch (err) {
          syncDescriptorCache().catch(() => {});
        }
        fetchSamples();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => fetchSamples())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchSamples())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (!q) return true;
      return g.name.toLowerCase().includes(q) || g.employeeId.toLowerCase().includes(q);
    });
  }, [groups, search]);

  const selectedGroup = useMemo(
    () => filteredGroups.find((g) => g.userId === selectedUserId) || null,
    [filteredGroups, selectedUserId]
  );

  const groupsMap = useMemo(() => new Map(groups.map((g) => [g.userId, g])), [groups]);

  const selectedSamples = useMemo(() => {
    if (!selectedGroup) return [];
    const list = [...selectedGroup.samples];
    if (sortBy === 'oldest') {
      return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    if (sortBy === 'confidence') {
      return list.sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0));
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedGroup, sortBy]);

  const selectedSlots = useMemo(() => selectedSamples.filter(isSlot), [selectedSamples]);
  const selectedPhotos = useMemo(() => selectedSamples.filter((s) => !isSlot(s)), [selectedSamples]);
  const showSlots = sourceFilter === 'all' || sourceFilter === 'slots';
  const showPhotos = sourceFilter === 'all' || sourceFilter === 'captured';
  const selectedSamplesForBulkDelete = useMemo(
    () => selectedPhotos.filter((sample) => selectedSampleIds.has(sample.id) && sample.image_url),
    [selectedPhotos, selectedSampleIds]
  );

  useEffect(() => {
    setSelectedSampleIds(new Set());
  }, [selectedUserId]);

  const toggleSampleSelection = (sampleId: string) => {
    setSelectedSampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId);
      else next.add(sampleId);
      return next;
    });
  };

  const selectAllPhotos = () => {
    const photoIds = selectedPhotos.filter((sample) => sample.image_url).map((sample) => sample.id);
    setSelectedSampleIds(new Set(photoIds));
  };

  const clearSelectedPhotos = () => {
    setSelectedSampleIds(new Set());
  };

  const handleBulkDeleteSelectedPhotos = async () => {
    if (selectedSamplesForBulkDelete.length === 0) {
      toast({ title: 'No photos selected', description: 'Select one or more face sample photos first.' });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedSamplesForBulkDelete.length} selected face sample photo${selectedSamplesForBulkDelete.length === 1 ? '' : 's'}?`
    );
    if (!confirmed) return;

    try {
      const descriptorIds = selectedSamplesForBulkDelete
        .filter((sample) => sample.source_table === 'face_descriptors')
        .map((sample) => sample.id);
      const attendanceIds = selectedSamplesForBulkDelete
        .filter((sample) => sample.source_table === 'attendance_records')
        .map((sample) => sample.id);

      if (descriptorIds.length > 0) {
        const { error } = await supabase.from('face_descriptors').delete().in('id', descriptorIds);
        if (error) throw error;
      }

      if (attendanceIds.length > 0) {
        const { error } = await supabase
          .from('attendance_records')
          .update({ image_url: null })
          .in('id', attendanceIds);
        if (error) throw error;
      }

      toast({
        title: 'Photos deleted',
        description: `Removed ${selectedSamplesForBulkDelete.length} selected face sample photo${selectedSamplesForBulkDelete.length === 1 ? '' : 's'}.`,
      });
      setSelectedSampleIds(new Set());
      fetchSamples();
      syncDescriptorCache().catch(() => {});
    } catch (error) {
      console.error('Failed bulk deleting sample photos:', error);
      toast({ title: 'Bulk delete failed', description: 'Could not delete selected sample photos.', variant: 'destructive' });
    }
  };

  const handleDeleteSample = async (sample: FaceSample) => {
    try {
      if (sample.source_table === 'face_descriptors') {
        const { error } = await supabase.from('face_descriptors').delete().eq('id', sample.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance_records')
          .update({ image_url: null })
          .eq('id', sample.id);
        if (error) throw error;
      }

      toast({ title: 'Image removed', description: 'Selected sample image was removed from model sample list.' });
      fetchSamples();
    } catch (error) {
      console.error('Failed deleting sample image:', error);
      toast({ title: 'Delete failed', description: 'Could not delete this sample image.', variant: 'destructive' });
    }
  };

  const openCropper = async (sample: FaceSample) => {
    if (!sample.image_url) {
      toast({ title: 'No image', description: 'This sample has no stored photo to edit.', variant: 'destructive' });
      return;
    }
    try {
      let src = sample.image_url;
      if (!src.startsWith('data:') && !src.startsWith('blob:')) {
        const response = await fetch(src);
        const blob = await response.blob();
        src = URL.createObjectURL(blob);
      }
      setCropSample(sample);
      setCropImageSrc(src);
      setCropOpen(true);
    } catch {
      toast({ title: 'Image load failed', description: 'Could not open sample image for editing.', variant: 'destructive' });
    }
  };

  const handleCropSave = async (croppedBlob: Blob) => {
    if (!cropSample) return;
    try {
      const folderId = (cropSample.user_id || 'unassigned')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const file = new File([croppedBlob], `sample_${cropSample.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadImage(file, `students/${folderId}/${file.name}`);

      const table = cropSample.source_table;
      const { error } = await supabase
        .from(table)
        .update({ image_url: url })
        .eq('id', cropSample.id);

      if (error) throw error;

      toast({ title: 'Updated', description: 'Sample photo was cropped and saved.' });
      setCropOpen(false);
      setCropSample(null);
      setCropImageSrc('');
      fetchSamples();
    } catch (error) {
      console.error('Failed updating sample image:', error);
      toast({ title: 'Save failed', description: 'Could not save cropped photo.', variant: 'destructive' });
    }
  };

  const handleTransferSample = async (sample: FaceSample) => {
    if (!transferTargetUserId) {
      toast({ title: 'Select student', description: 'Please choose a student to transfer this photo.', variant: 'destructive' });
      return;
    }

    if (transferTargetUserId === sample.user_id) {
      toast({ title: 'Same student', description: 'Choose a different student for transfer.', variant: 'destructive' });
      return;
    }

    try {
      const target = groupsMap.get(transferTargetUserId);
      const updatePayload: Record<string, any> = { user_id: transferTargetUserId };

      if (sample.source_table === 'face_descriptors') {
        updatePayload.label = target?.name || null;
      }

      const { error } = await supabase
        .from(sample.source_table)
        .update(updatePayload)
        .eq('id', sample.id);

      if (error) throw error;

      toast({ title: 'Photo transferred', description: 'Sample photo was moved to the selected student.' });
      setTransferSampleId(null);
      setTransferTargetUserId('');
      fetchSamples();
    } catch (error) {
      console.error('Failed transferring sample image:', error);
      toast({ title: 'Transfer failed', description: 'Could not transfer this sample image.', variant: 'destructive' });
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedGroup) return;
    const confirmed = window.confirm(
      `Delete ALL face data for ${selectedGroup.name} (${selectedGroup.employeeId})?\n\nThis removes trained slots and clears all captured sample photos. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingStudent(true);
    try {
      const recordIds: string[] = [];
      const descriptorIds: string[] = [];
      selectedGroup.samples.forEach((s) => {
        if (s.source_table === 'face_descriptors') descriptorIds.push(s.id);
        else recordIds.push(s.id);
      });

      // SAFEGUARD: Only touch rows explicitly visible under the selected student group.
      // Never delete by user_id here because legacy datasets may share user_id across students.
      const uniqueDescriptorIds = Array.from(new Set(descriptorIds));
      const uniqueRecordIds = Array.from(new Set(recordIds));

      // Snapshot rows before mutation for rollback safety.
      let descriptorBackup: any[] = [];
      let attendanceBackup: Array<{ id: string; image_url: string | null }> = [];

      if (uniqueDescriptorIds.length > 0) {
        const { data, error } = await supabase
          .from('face_descriptors')
          .select('*')
          .in('id', uniqueDescriptorIds);
        if (error) throw error;
        descriptorBackup = data || [];
      }

      if (uniqueRecordIds.length > 0) {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('id, image_url')
          .in('id', uniqueRecordIds);
        if (error) throw error;
        attendanceBackup = data || [];
      }

      // 1) Delete only selected descriptors by primary key.
      if (uniqueDescriptorIds.length > 0) {
        const { error } = await supabase.from('face_descriptors').delete().in('id', uniqueDescriptorIds);
        if (error) throw error;
      }

      // 2) Clear only selected captured sample images by primary key.
      if (uniqueRecordIds.length > 0) {
        const { error } = await supabase
          .from('attendance_records')
          .update({ image_url: null })
          .in('id', uniqueRecordIds);
        if (error) {
          // Rollback descriptors if second step fails.
          if (descriptorBackup.length > 0) {
            await supabase.from('face_descriptors').insert(descriptorBackup);
          }
          throw error;
        }
      }

      toast({
        title: 'Student data deleted',
        description: `Removed ${uniqueDescriptorIds.length} trained slots and ${uniqueRecordIds.length} captured samples for ${selectedGroup.name}.`,
      });
      setSelectedUserId('');
      fetchSamples();
      syncDescriptorCache().catch(() => {});
    } catch (error) {
      console.error('Failed deleting student face data:', error);
      toast({
        title: 'Delete failed',
        description: 'Could not delete this student\'s face data.',
        variant: 'destructive',
      });
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleSetAsIdCardPhoto = async (sample: FaceSample) => {
    const persistentImageRef = toPersistentImageReference(sample.image_url);

    if (!selectedGroup || !persistentImageRef) {
      toast({ title: 'No photo', description: 'This sample does not have an image to set.', variant: 'destructive' });
      return;
    }

    try {
      const filters: string[] = [];
      if (selectedGroup.userId) filters.push(`user_id.eq.${selectedGroup.userId}`);
      if (selectedGroup.employeeId) filters.push(`student_id.eq.${selectedGroup.employeeId}`);
      if (filters.length === 0) return;

      const { data: registrationRows, error: regFetchError } = await supabase
        .from('attendance_records')
        .select('id, device_info')
        .eq('status', 'registered')
        .or(filters.join(','));

      if (regFetchError) throw regFetchError;

      for (const row of registrationRows || []) {
        const currentDeviceInfo = (row.device_info as Record<string, any>) || {};
        const currentMetadata = (currentDeviceInfo.metadata as Record<string, any>) || {};
        const currentFaceModel = (currentMetadata.face_model as Record<string, any>) || {};

        const nextDeviceInfo = {
          ...currentDeviceInfo,
          metadata: {
            ...currentMetadata,
            id_card_photo_url: persistentImageRef,
            face_model: {
              ...currentFaceModel,
              id_card_photo_url: persistentImageRef,
            },
          },
        };

        const { error: regUpdateError } = await supabase
          .from('attendance_records')
          .update({ device_info: nextDeviceInfo })
          .eq('id', row.id);

        if (regUpdateError) throw regUpdateError;
      }

      const descriptorFilters: string[] = [];
      if (selectedGroup.userId) descriptorFilters.push(`user_id.eq.${selectedGroup.userId}`);
      if (selectedGroup.employeeId) descriptorFilters.push(`student_id.eq.${selectedGroup.employeeId}`);

      if (descriptorFilters.length > 0) {
        const { error: descriptorUpdateError } = await supabase
          .from('face_descriptors')
          .update({ image_url: persistentImageRef })
          .or(descriptorFilters.join(','));

        if (descriptorUpdateError) throw descriptorUpdateError;
      }

      toast({ title: 'ID card photo updated', description: 'Selected sample is now the default ID card photo.' });
      fetchSamples();
    } catch (error) {
      console.error('Failed setting ID card photo:', error);
      toast({ title: 'Update failed', description: 'Could not set this image as ID card photo.', variant: 'destructive' });
    }
  };

  const handleMergeStudentData = async () => {
    if (!selectedGroup || !mergeTargetUserId) {
      toast({ title: 'Select target', description: 'Choose a student to merge into.', variant: 'destructive' });
      return;
    }

    if (mergeTargetUserId === selectedGroup.userId) {
      toast({ title: 'Same student', description: 'Choose a different target student.', variant: 'destructive' });
      return;
    }

    const target = groupsMap.get(mergeTargetUserId);
    if (!target) {
      toast({ title: 'Not found', description: 'Target student was not found.', variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(
      `Merge ${selectedGroup.name} (${selectedGroup.employeeId}) into ${target.name} (${target.employeeId})?\n\nThis will move face samples and registration identity to the target student and remove duplicate registration rows.`
    );
    if (!confirmed) return;

    setMergingStudent(true);
    try {
      const sourceUserId = selectedGroup.userId;
      const sourceEmployeeId = selectedGroup.employeeId;
      const targetUserId = target.userId;
      const targetEmployeeId = target.employeeId;

      const descriptorFilters: string[] = [];
      if (sourceUserId) descriptorFilters.push(`user_id.eq.${sourceUserId}`);
      if (sourceEmployeeId) descriptorFilters.push(`student_id.eq.${sourceEmployeeId}`);

      if (descriptorFilters.length > 0) {
        const { error: moveDescriptorsError } = await supabase
          .from('face_descriptors')
          .update({
            user_id: targetUserId,
            student_id: targetEmployeeId,
            label: target.name,
          })
          .or(descriptorFilters.join(','));
        if (moveDescriptorsError) throw moveDescriptorsError;
      }

      const regFilters: string[] = [];
      if (sourceUserId) regFilters.push(`user_id.eq.${sourceUserId}`);
      if (sourceEmployeeId) regFilters.push(`student_id.eq.${sourceEmployeeId}`);

      if (regFilters.length > 0) {
        const { error: moveRegistrationError } = await supabase
          .from('attendance_records')
          .update({ user_id: targetUserId, student_id: targetEmployeeId, student_name: target.name })
          .neq('status', 'unauthorized')
          .or(regFilters.join(','));
        if (moveRegistrationError) throw moveRegistrationError;
      }

      const targetRegistrationFilters: string[] = [];
      if (targetUserId) targetRegistrationFilters.push(`user_id.eq.${targetUserId}`);
      if (targetEmployeeId) targetRegistrationFilters.push(`student_id.eq.${targetEmployeeId}`);

      if (targetRegistrationFilters.length > 0) {
        const { data: targetRegistrations, error: fetchTargetRegsError } = await supabase
          .from('attendance_records')
          .select('id, timestamp')
          .eq('status', 'registered')
          .or(targetRegistrationFilters.join(','))
          .order('timestamp', { ascending: false });

        if (fetchTargetRegsError) throw fetchTargetRegsError;

        const rowsToDelete = (targetRegistrations || []).slice(1).map((r: any) => r.id);
        if (rowsToDelete.length > 0) {
          const { error: deleteDupeRegsError } = await supabase
            .from('attendance_records')
            .delete()
            .in('id', rowsToDelete);
          if (deleteDupeRegsError) throw deleteDupeRegsError;
        }
      }

      toast({
        title: 'Students merged',
        description: `${selectedGroup.name} data merged into ${target.name}.`,
      });

      setMergeTargetUserId('');
      setSelectedUserId(target.userId);
      fetchSamples();
      syncDescriptorCache().catch(() => {});
    } catch (error) {
      console.error('Failed merging student data:', error);
      toast({ title: 'Merge failed', description: 'Could not merge selected student data.', variant: 'destructive' });
    } finally {
      setMergingStudent(false);
    }
  };

  const handleReregisterFromExistingData = async () => {
    if (!selectedGroup) return;

    const sourceFilters: string[] = [];
    if (selectedGroup.userId) sourceFilters.push(`user_id.eq.${selectedGroup.userId}`);
    if (selectedGroup.employeeId) sourceFilters.push(`student_id.eq.${selectedGroup.employeeId}`);

    if (sourceFilters.length === 0) {
      toast({ title: 'Missing identity', description: 'Cannot recover this student without user/student id.', variant: 'destructive' });
      return;
    }

    setReregisteringStudent(true);
    try {
      const descriptorSamples = selectedGroup.samples.filter((s) => s.source_table === 'face_descriptors');
      const bestImageSample =
        descriptorSamples.find((s) => !!s.image_url) ||
        selectedGroup.samples.find((s) => !!s.image_url) ||
        null;
      const bestImageRef = toPersistentImageReference(bestImageSample?.image_url || null);

      const existingUuid =
        selectedGroup.samples.map((s) => s.user_id).find((id) => isUuid(id)) ||
        (isUuid(selectedGroup.userId) ? selectedGroup.userId : null);
      const resolvedUserId = existingUuid || crypto.randomUUID();

      const { data: contextRow } = await supabase
        .from('attendance_records')
        .select('id, category, class, section, device_info')
        .neq('status', 'unauthorized')
        .or(sourceFilters.join(','))
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      const existingMetadata = ((contextRow as any)?.device_info as any)?.metadata || {};
      const category = (contextRow as any)?.category || existingMetadata?.category || 'A';
      const classValue = (contextRow as any)?.class || existingMetadata?.class_section || existingMetadata?.department || null;
      const sectionValue = (contextRow as any)?.section || existingMetadata?.section || null;

      const registrationPayload: Record<string, any> = {
        user_id: resolvedUserId,
        status: 'registered',
        source: 'registration',
        capture_mode: existingMetadata?.face_model?.capture_mode || 'scan-3d',
        class: classValue,
        section: sectionValue,
        student_name: selectedGroup.name,
        student_id: selectedGroup.employeeId,
        category,
        image_url: bestImageRef,
        timestamp: new Date().toISOString(),
        device_info: {
          type: 'recovery',
          registration: 'true',
          timestamp: new Date().toISOString(),
          metadata: {
            ...existingMetadata,
            name: selectedGroup.name,
            employee_id: selectedGroup.employeeId,
            category,
            firebase_image_url: bestImageRef || existingMetadata?.firebase_image_url || null,
            face_model: {
              ...(existingMetadata?.face_model || {}),
              id_card_photo_url:
                existingMetadata?.face_model?.id_card_photo_url ||
                bestImageRef ||
                null,
            },
          },
        },
      };

      const { data: existingRegistration, error: existingRegError } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('status', 'registered')
        .or(sourceFilters.join(','))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRegError) throw existingRegError;

      if (existingRegistration?.id) {
        const { error: updateRegError } = await supabase
          .from('attendance_records')
          .update(registrationPayload)
          .eq('id', existingRegistration.id);
        if (updateRegError) throw updateRegError;
      } else {
        const { error: insertRegError } = await supabase
          .from('attendance_records')
          .insert(registrationPayload);
        if (insertRegError) throw insertRegError;
      }

      const descriptorIds = descriptorSamples.map((s) => s.id);
      if (descriptorIds.length > 0) {
        const descriptorPatch: Record<string, any> = {
          user_id: resolvedUserId,
          student_id: selectedGroup.employeeId,
          student_name: selectedGroup.name,
          label: selectedGroup.name,
          is_active: true,
        };
        if (bestImageRef) descriptorPatch.image_url = bestImageRef;

        const { error: descriptorUpdateError } = await supabase
          .from('face_descriptors')
          .update(descriptorPatch)
          .in('id', descriptorIds);
        if (descriptorUpdateError) throw descriptorUpdateError;
      }

      const { error: normalizeRowsError } = await supabase
        .from('attendance_records')
        .update({
          user_id: resolvedUserId,
          student_id: selectedGroup.employeeId,
          student_name: selectedGroup.name,
        })
        .neq('status', 'unauthorized')
        .or(sourceFilters.join(','));
      if (normalizeRowsError) throw normalizeRowsError;

      toast({
        title: 'Student re-registered',
        description: `${selectedGroup.name} is restored using existing face samples and linked for scanning again.`,
      });

      await fetchSamples();
      syncDescriptorCache().catch(() => {});
    } catch (error) {
      console.error('Failed to re-register student from existing data:', error);
      toast({ title: 'Recovery failed', description: 'Could not re-register this student from existing samples.', variant: 'destructive' });
    } finally {
      setReregisteringStudent(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Student Face Samples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search student by name or ID..." />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'confidence')}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="confidence">Sort: Confidence</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'slots' | 'captured')}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Show: All sources</option>
              <option value="slots">Show: Trained Slots only</option>
              <option value="captured">Show: Captured Samples only</option>
            </select>
            <Button variant="outline" size="sm" onClick={fetchSamples}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{groups.length} Students</Badge>
            <Badge variant="secondary">{groups.reduce((sum, g) => sum + g.samples.length, 0)} Total Samples</Badge>
          </div>

          <ScrollArea className="max-h-none pr-2">
            <div className="space-y-2">
              {(selectedUserId ? filteredGroups.filter((g) => g.userId === selectedUserId) : filteredGroups).map((g) => (
                <button
                  key={g.userId}
                  onClick={() => setSelectedUserId(selectedUserId === g.userId ? '' : g.userId)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${selectedUserId === g.userId ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1"><User className="w-3.5 h-3.5" /> {g.name}</p>
                      <p className="text-xs text-muted-foreground truncate">ID: {g.employeeId}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{g.samples.length} photos</Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          {selectedUserId && (
            <Button variant="outline" size="sm" onClick={() => setSelectedUserId('')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to all students
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {selectedGroup && (
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{selectedGroup.name}</p>
                <p className="text-xs text-muted-foreground truncate">ID: {selectedGroup.employeeId}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAllPhotos} disabled={selectedPhotos.length === 0}>
                  Select all photos
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelectedPhotos} disabled={selectedSampleIds.size === 0}>
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteSelectedPhotos}
                  disabled={selectedSamplesForBulkDelete.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete selected photos ({selectedSamplesForBulkDelete.length})
                </Button>
                <select
                  value={mergeTargetUserId}
                  onChange={(e) => setMergeTargetUserId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Merge into...</option>
                  {groups
                    .filter((g) => g.userId !== selectedGroup.userId)
                    .map((g) => (
                      <option key={g.userId} value={g.userId}>
                        {g.name} ({g.employeeId})
                      </option>
                    ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReregisterFromExistingData}
                  disabled={reregisteringStudent || selectedGroup.samples.length === 0}
                >
                  <User className="w-4 h-4 mr-1" />
                  {reregisteringStudent ? 'Re-registering...' : 'Re-register'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMergeStudentData}
                  disabled={mergingStudent || !mergeTargetUserId}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  {mergingStudent ? 'Merging...' : 'Merge'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteStudent}
                  disabled={deletingStudent || selectedGroup.samples.length === 0}
                >
                  <UserX className="w-4 h-4 mr-1" />
                  {deletingStudent ? 'Deleting...' : 'Delete student data'}
                </Button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : !selectedGroup ? (
            <div className="text-center py-10 text-muted-foreground">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Select a student to view all model training and recognition images.
            </div>
          ) : selectedSamples.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              No face samples available for this student.
            </div>
          ) : (
            (() => {
              const renderCard = (sample: FaceSample) => (
                <div key={sample.id} className="rounded-lg border p-3 bg-card">
                  {!isSlot(sample) && (
                    <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedSampleIds.has(sample.id)}
                        onChange={() => toggleSampleSelection(sample.id)}
                      />
                      Select photo for bulk delete
                    </label>
                  )}
                  <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2 flex items-center justify-center">
                    {sample.image_url ? (
                      <img src={sample.image_url} alt={`${selectedGroup.name} sample`} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{selectedGroup.name}</p>
                  <p className="text-xs text-muted-foreground truncate">ID: {selectedGroup.employeeId}</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {sample.source === 'descriptor_registration' && <Badge variant="default" className="text-[10px]">Model Training (Descriptors)</Badge>}
                    {sample.source === 'record_registration' && <Badge variant="outline" className="text-[10px]">Register Page</Badge>}
                    {sample.source === 'recognition_attendance' && <Badge variant="secondary" className="text-[10px]">Attendance Recognition 80%+</Badge>}
                    {sample.source === 'recognition_gate' && <Badge variant="secondary" className="text-[10px]">Gate Mode Recognition 80%+</Badge>}
                    {typeof sample.confidence_score === 'number' && (
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(sample.confidence_score * 100)}%
                      </Badge>
                    )}
                    {sample.status && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {sample.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(sample.created_at).toLocaleString()}</p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <Button size="sm" variant="outline" className="w-full" onClick={() => openCropper(sample)} disabled={!sample.image_url}>
                      <Scissors className="w-3.5 h-3.5 mr-1" /> Edit / Crop
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => handleSetAsIdCardPhoto(sample)} disabled={!sample.image_url}>
                      Set as ID photo
                    </Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => handleDeleteSample(sample)} disabled={!sample.image_url}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setTransferSampleId(sample.id);
                        setTransferTargetUserId('');
                      }}
                      disabled={groups.length < 2}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Transfer
                    </Button>
                  </div>

                  {transferSampleId === sample.id && (
                    <div className="mt-2 rounded-md border border-border p-2 space-y-2 bg-background">
                      <p className="text-xs text-muted-foreground">Transfer this photo to another student</p>
                      <select
                        value={transferTargetUserId}
                        onChange={(e) => setTransferTargetUserId(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Select student...</option>
                        {groups
                          .filter((g) => g.userId !== sample.user_id)
                          .map((g) => (
                            <option key={g.userId} value={g.userId}>
                              {g.name} ({g.employeeId})
                            </option>
                          ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" onClick={() => handleTransferSample(sample)} disabled={!transferTargetUserId}>
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTransferSampleId(null);
                            setTransferTargetUserId('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
              return (
                <div className="space-y-6">
                  {showSlots && (<section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Trained Slots (Live Recognition Model)</h3>
                      <Badge variant="default" className="text-[10px]">{selectedSlots.length} slots</Badge>
                    </div>
                    {selectedSlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No trained slots — this student is not yet in the live recognition model.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {selectedSlots.map(renderCard)}
                      </div>
                    )}
                  </section>)}
                  {showPhotos && (<section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Captured Samples (Register / Attendance / Gate)</h3>
                      <Badge variant="secondary" className="text-[10px]">{selectedPhotos.length} samples</Badge>
                    </div>
                    {selectedPhotos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No captured sample photos for this student yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {selectedPhotos.map(renderCard)}
                      </div>
                    )}
                  </section>)}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      <ImageCropper
        open={cropOpen}
        imageSrc={cropImageSrc}
        onCancel={() => {
          setCropOpen(false);
          setCropSample(null);
          setCropImageSrc('');
        }}
        onCropComplete={handleCropSave}
      />
    </div>
  );
};

export default StudentFaceSamplesManager;
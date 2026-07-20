import { supabase } from '@/integrations/supabase/client';

const CLASS_ACCESS_PREFIX = 'class_access:';

const normalizeCategory = (value: string): string | null => {
  const raw = (value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d+)-([A-D])$/i);
  if (!match) return null;
  return `${match[1]}-${match[2].toUpperCase()}`;
};

export const parseClassSection = (category: string): { className: string; section: string } | null => {
  const normalized = normalizeCategory(category);
  if (!normalized) return null;
  const [className, section] = normalized.split('-');
  return { className, section };
};

const categoryFromPermissionKey = (key: string): string | null => {
  const raw = (key || '').trim();
  if (!raw) return null;
  if (raw.startsWith(CLASS_ACCESS_PREFIX)) {
    return normalizeCategory(raw.slice(CLASS_ACCESS_PREFIX.length));
  }
  if (/^\d+-[A-D]$/i.test(raw)) {
    return normalizeCategory(raw);
  }
  return null;
};

export const toClassAccessPermission = (category: string) => `${CLASS_ACCESS_PREFIX}${category}`;

export async function fetchTeacherCategories(userId: string): Promise<string[]> {
  const db = supabase as any;
  const categories = new Set<string>();

  const newShape = await db
    .from('teacher_permissions')
    .select('permission_key, is_enabled')
    .eq('teacher_id', userId);

  if (!newShape.error && Array.isArray(newShape.data)) {
    newShape.data.forEach((row: any) => {
      if (row?.is_enabled === false) return;
      const category = categoryFromPermissionKey(String(row?.permission_key || ''));
      if (category) categories.add(category);
    });
  }

  const legacyShape = await db
    .from('teacher_permissions')
    .select('category')
    .eq('user_id', userId);

  if (!legacyShape.error && Array.isArray(legacyShape.data)) {
    legacyShape.data.forEach((row: any) => {
      const category = normalizeCategory(String(row?.category || ''));
      if (category) categories.add(category);
    });
  }

  return [...categories];
}

export async function hasTeacherAccess(userId: string): Promise<boolean> {
  const db = supabase as any;

  const categories = await fetchTeacherCategories(userId);
  if (categories.length > 0) return true;

  const classTeacherRows = await db
    .from('class_teachers')
    .select('id')
    .eq('teacher_id', userId)
    .limit(1);

  if (!classTeacherRows.error && Array.isArray(classTeacherRows.data) && classTeacherRows.data.length > 0) {
    return true;
  }

  const legacyTeacherRows = await db
    .from('attendance_records')
    .select('id')
    .eq('user_id', userId)
    .eq('category', 'Teacher')
    .eq('status', 'registered')
    .limit(1);

  return !legacyTeacherRows.error && Array.isArray(legacyTeacherRows.data) && legacyTeacherRows.data.length > 0;
}

export async function saveTeacherCategories(userId: string, categories: string[]): Promise<void> {
  const db = supabase as any;
  const normalized = [...new Set(categories.map(c => normalizeCategory(c)).filter(Boolean))] as string[];
  let wrote = false;
  let lastError: any = null;

  const newRows = normalized.map(category => ({
    teacher_id: userId,
    permission_key: toClassAccessPermission(category),
    is_enabled: true,
  }));

  const newDelete = await db.from('teacher_permissions').delete().eq('teacher_id', userId);
  if (!newDelete.error) {
    if (newRows.length > 0) {
      const newInsert = await db.from('teacher_permissions').insert(newRows);
      if (newInsert.error) {
        lastError = newInsert.error;
      } else {
        wrote = true;
      }
    } else {
      wrote = true;
    }
  } else {
    lastError = newDelete.error;
  }

  const legacyRows = normalized.map(category => ({
    user_id: userId,
    category,
    can_take_attendance: true,
    can_view_reports: true,
  }));

  const legacyDelete = await db.from('teacher_permissions').delete().eq('user_id', userId);
  if (!legacyDelete.error) {
    if (legacyRows.length > 0) {
      const legacyInsert = await db.from('teacher_permissions').insert(legacyRows);
      if (legacyInsert.error) {
        if (!wrote) lastError = legacyInsert.error;
      } else {
        wrote = true;
      }
    } else {
      wrote = true;
    }
  } else if (!wrote) {
    lastError = legacyDelete.error;
  }

  if (!wrote && lastError) throw lastError;
}

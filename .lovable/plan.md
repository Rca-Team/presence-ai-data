## Goal
Make the teacher + timetable system work end-to-end for practical use, including promoting an already-registered student to teacher directly from the **Students** list.

## What I’ll build
1. **Add “Make Teacher” action in Students list**
   - Add a new action in `AdminFacesList` row menu.
   - Open a manual assignment dialog to:
     - choose class/section
     - set teacher scope you requested (class teacher assignment, timetable assignment, substitutions, timetable view)
   - Save assignment in the same data model used by teacher features.

2. **Unify teacher identity and assignment logic (single source of truth)**
   - Standardize on one teacher identity key across admin + teacher flows (avoid mixed `record_id` vs `user_id` behavior).
   - Ensure promotion writes all required teacher links so the teacher appears immediately in:
     - teacher dashboards
     - timetable assignment pickers
     - substitution flows

3. **Fix timetable data flow for real usage**
   - Refactor `TimetableManager` so each slot is tied to the actual teacher user assignment used by teacher portal and substitutions.
   - Keep per-class-section timetable usable even when testing only one class.
   - Add validation to prevent invalid/empty slot assignment saves.

4. **Fix teacher-specific capability behavior**
   - Ensure the requested teacher capabilities map cleanly in UI + data:
     - class teacher responsibility
     - timetable visibility
     - substitution handling
   - Remove current mismatches where different screens expect different teacher fields/columns.

5. **Hardening for practical operation**
   - Add defensive loading/error handling around role/teacher checks.
   - Ensure role resolution and teacher route gating are consistent after promotion (no refresh hacks needed).

## Files to update
- `src/components/admin/AdminFacesList.tsx` (new “Make Teacher” UI/action)
- `src/components/admin/TimetableManager.tsx` (teacher-slot assignment consistency)
- `src/hooks/useUserRole.ts` (consistent teacher detection)
- `src/pages/TeacherPortal.tsx` (assignment read consistency)
- `src/components/admin/UserAccessManager.tsx` (shared teacher assignment contract)
- `src/integrations/supabase/types.ts` usage touchpoints where type mismatches currently force inconsistent fields

## Technical details
- Existing code currently mixes multiple teacher/timetable contracts across screens:
  - `TeacherPortal` reads `class_teachers` with `class/section/teacher_id`.
  - `TimetableManager` assigns teachers from attendance records using record IDs.
  - role/teacher checks rely on teacher permission records in other screens.
- I’ll make these flows use one consistent assignment path so promotion from Students list immediately powers timetable + teacher behavior without manual extra steps.

## Acceptance criteria
- From **Admin → Students**, admin can promote a registered student to teacher in one flow.
- Promoted teacher appears in teacher assignment lists and can be assigned timetable slots.
- Teacher can open teacher features and see relevant timetable/substitution data.
- No broken/empty teacher states caused by ID-field mismatches.
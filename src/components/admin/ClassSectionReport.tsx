import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Printer, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CLASSES, SECTIONS, getCategoryLabel, ALL_CATEGORIES } from '@/constants/schoolConfig';
import { isWorkingDayForSchool } from '@/utils/workingDays';

const ClassSectionReport: React.FC = () => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateClassReport = async () => {
    if (!selectedCategory) {
      toast({ title: 'Select a class', description: 'Please select a class & section first.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      // Fetch all registered students in this category (attendance_records is canonical)
      const [registeredRes, attendanceRes, gateRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id, user_id, device_info, image_url, category')
          .eq('status', 'registered'),
        supabase
          .from('attendance_records')
          .select('id, user_id, device_info, status, timestamp, category')
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .lte('timestamp', today.toISOString())
          .in('status', ['present', 'late', 'unauthorized'])
          .eq('category', selectedCategory),
        supabase
          .from('gate_entries')
          .select('student_id, student_name, entry_time')
          .gte('entry_time', thirtyDaysAgo.toISOString())
          .lte('entry_time', today.toISOString())
          .eq('is_recognized', true),
      ]);
      // Filter to the selected category
      const seenStudents = new Set<string>();
      const registeredStudents = (registeredRes.data || []).filter((r: any) => {
        const cat = r.category || '';
        return cat === selectedCategory;
      });
      const attendanceRecords = attendanceRes.data;

      if (!registeredStudents || registeredStudents.length === 0) {
        toast({ title: 'No students', description: `No students found in ${getCategoryLabel(selectedCategory)}.`, variant: 'destructive' });
        setIsGenerating(false);
        return;
      }

      // Generate working days
      const workingDays: Date[] = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        if (isWorkingDayForSchool(date)) workingDays.push(date);
      }
      const totalWorkDays = workingDays.length;

      // Build student map (deduplicated by employee_id)
      const studentMap = new Map<string, {
        name: string;
        employeeId: string;
        present: number;
        late: number;
        absent: number;
      }>();

      registeredStudents.forEach(record => {
        const di = (record.device_info as any) || {};
        const metadata = di.metadata || {};
        const name = metadata.name || di.name || 'Unknown';
        const employeeId = metadata.employee_id || di.employee_id || 'N/A';
        const key = record.user_id || employeeId || record.id;
        if (!name || name === 'Unknown' || seenStudents.has(key)) return;
        seenStudents.add(key);
        studentMap.set(key, { name, employeeId, present: 0, late: 0, absent: totalWorkDays });
      });

      // Process attendance
      const attendanceByStudent = new Map<string, Map<string, string>>();
      (attendanceRecords || []).forEach(record => {
        const deviceInfo = record.device_info as any;
        const employeeId = deviceInfo?.metadata?.employee_id;
        const recordName = deviceInfo?.metadata?.name;
        const userId = record.user_id;

        // Match to a registered student
        let matchedKey: string | null = null;
        for (const [key, student] of studentMap) {
          if (userId && key === userId) { matchedKey = key; break; }
          if (employeeId && student.employeeId === employeeId) { matchedKey = key; break; }
          if (recordName && student.name.toLowerCase() === recordName.toLowerCase()) { matchedKey = key; break; }
        }

        if (matchedKey) {
          if (!attendanceByStudent.has(matchedKey)) attendanceByStudent.set(matchedKey, new Map());
          const dateKey = new Date(record.timestamp).toDateString();
          const existing = attendanceByStudent.get(matchedKey)!.get(dateKey);
          // present overrides late
          if (!existing || (existing === 'late' && record.status === 'present')) {
            attendanceByStudent.get(matchedKey)!.set(dateKey, record.status === 'unauthorized' ? 'present' : record.status!);
          }
        }
      });

      (gateRes.data || []).forEach((gate: any) => {
        const dateKey = new Date(gate.entry_time).toDateString();
        const gateId = gate.student_id;
        const matched = Array.from(studentMap.keys()).find(key => key === gateId);
        if (matched) {
          if (!attendanceByStudent.has(matched)) attendanceByStudent.set(matched, new Map());
          if (!attendanceByStudent.get(matched)!.has(dateKey)) attendanceByStudent.get(matched)!.set(dateKey, 'present');
        }
      });

      // Calculate stats per student
      for (const [key, student] of studentMap) {
        const dayMap = attendanceByStudent.get(key);
        if (dayMap) {
          let present = 0, late = 0;
          workingDays.forEach(d => {
            const status = dayMap.get(d.toDateString());
            if (status === 'present') present++;
            else if (status === 'late') late++;
          });
          student.present = present;
          student.late = late;
          student.absent = totalWorkDays - present - late;
        }
      }

      const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      const totalPresent = students.reduce((s, st) => s + st.present, 0);
      const totalLate = students.reduce((s, st) => s + st.late, 0);
      const totalAbsent = students.reduce((s, st) => s + st.absent, 0);
      const overallRate = students.length > 0 && totalWorkDays > 0
        ? (((totalPresent + totalLate) / (students.length * totalWorkDays)) * 100).toFixed(1)
        : '0.0';

      // Open print window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({ title: 'Popup blocked', description: 'Please allow popups to print the report.', variant: 'destructive' });
        setIsGenerating(false);
        return;
      }

      const formatDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const studentRows = students.map((st, i) => {
        const rate = totalWorkDays > 0 ? (((st.present + st.late) / totalWorkDays) * 100).toFixed(1) : '0.0';
        const rateNum = parseFloat(rate);
        const rateColor = rateNum >= 90 ? '#059669' : rateNum >= 75 ? '#d97706' : '#dc2626';
        const rateBg = rateNum >= 90 ? '#ecfdf5' : rateNum >= 75 ? '#fffbeb' : '#fef2f2';
        return `<tr>
          <td style="text-align:center;color:#94a3b8">${i + 1}</td>
          <td><strong>${st.name}</strong><br/><span style="font-size:11px;color:#94a3b8">${st.employeeId}</span></td>
          <td style="text-align:center"><span class="badge badge-present">${st.present}</span></td>
          <td style="text-align:center"><span class="badge badge-late">${st.late}</span></td>
          <td style="text-align:center"><span class="badge badge-absent">${st.absent}</span></td>
          <td style="text-align:center"><span style="background:${rateBg};color:${rateColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">${rate}%</span></td>
        </tr>`;
      }).join('');

      printWindow.document.write(`
        <html>
        <head>
          <title>${getCategoryLabel(selectedCategory)} — Attendance Report</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Inter',-apple-system,sans-serif; color:#1e293b; background:#f8fafc; }
            .page { max-width:960px; margin:0 auto; background:white; min-height:100vh; }
            .header { background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0ea5e9 100%); padding:40px 48px 36px; position:relative; overflow:hidden; }
            .header::before { content:''; position:absolute; top:-60%; right:-20%; width:500px; height:500px; background:radial-gradient(circle,rgba(14,165,233,0.15) 0%,transparent 70%); border-radius:50%; }
            .header-top { display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:1; }
            .brand { display:flex; align-items:center; gap:12px; }
            .brand-icon { width:40px; height:40px; background:rgba(255,255,255,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center; }
            .brand-icon svg { color:white; }
            .brand-text { font-size:13px; font-weight:600; color:rgba(255,255,255,0.9); letter-spacing:0.5px; }
            .header-date { font-size:12px; color:rgba(255,255,255,0.5); text-align:right; }
            .header-main { margin-top:28px; position:relative; z-index:1; }
            .header-main h1 { font-size:28px; font-weight:800; color:white; letter-spacing:-0.5px; }
            .header-subtitle { font-size:14px; color:rgba(255,255,255,0.6); margin-top:4px; }
            .header-meta { display:flex; gap:16px; margin-top:20px; position:relative; z-index:1; flex-wrap:wrap; }
            .meta-chip { display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1); padding:6px 14px; border-radius:20px; font-size:12px; color:rgba(255,255,255,0.85); font-weight:500; }

            .stats-section { padding:28px 48px; display:grid; grid-template-columns:repeat(4,1fr); gap:16px; border-bottom:1px solid #f1f5f9; }
            .stat-card { padding:20px; border-radius:16px; border:1px solid #f1f5f9; background:#fafbfc; text-align:center; }
            .stat-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; color:#94a3b8; margin-bottom:8px; }
            .stat-value { font-size:28px; font-weight:800; letter-spacing:-1px; }
            .stat-sub { font-size:12px; color:#94a3b8; margin-top:4px; }

            .table-section { padding:28px 48px 48px; }
            .section-title { font-size:14px; font-weight:700; color:#1e293b; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
            .section-title .dot { width:8px; height:8px; border-radius:50%; background:#0ea5e9; }
            .report-table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
            .report-table thead th { background:#f8fafc; padding:12px 16px; text-align:left; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; border-bottom:2px solid #e2e8f0; }
            .report-table thead th:first-child { border-radius:10px 0 0 0; }
            .report-table thead th:last-child { border-radius:0 10px 0 0; }
            .report-table tbody td { padding:12px 16px; border-bottom:1px solid #f1f5f9; color:#334155; }
            .report-table tbody tr:hover { background:#f8fafc; }

            .badge { display:inline-flex; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
            .badge-present { background:#ecfdf5; color:#059669; }
            .badge-late { background:#fffbeb; color:#d97706; }
            .badge-absent { background:#fef2f2; color:#dc2626; }

            .footer { padding:24px 48px; background:#f8fafc; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; }
            .footer-text { font-size:11px; color:#94a3b8; }
            .print-btn { background:linear-gradient(135deg,#0ea5e9,#6366f1); color:white; border:none; padding:10px 28px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; }
            .print-btn:hover { transform:translateY(-1px); box-shadow:0 4px 20px rgba(14,165,233,0.3); }

            @media print {
              body { background:white; }
              .print-btn { display:none !important; }
              .header, .stat-card, .badge, span[style] { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="header-top">
                <div class="brand">
                  <div class="brand-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                  </div>
                  <span class="brand-text">PRESENCE SYSTEM</span>
                </div>
                <div class="header-date">Generated<br/><strong>${formatDate(today)}</strong></div>
              </div>
              <div class="header-main">
                <h1>${getCategoryLabel(selectedCategory)}</h1>
                <div class="header-subtitle">Class Attendance Report — Last 30 Working Days</div>
              </div>
              <div class="header-meta">
                <div class="meta-chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  ${students.length} Students
                </div>
                <div class="meta-chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  ${formatDate(thirtyDaysAgo)} — ${formatDate(today)}
                </div>
                <div class="meta-chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  ${totalWorkDays} Working Days
                </div>
              </div>
            </div>

            <div class="stats-section">
              <div class="stat-card">
                <div class="stat-label">Students</div>
                <div class="stat-value" style="color:#0ea5e9">${students.length}</div>
                <div class="stat-sub">Registered</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Avg Present</div>
                <div class="stat-value" style="color:#10b981">${students.length > 0 ? (totalPresent / students.length).toFixed(1) : 0}</div>
                <div class="stat-sub">days/student</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Avg Late</div>
                <div class="stat-value" style="color:#f59e0b">${students.length > 0 ? (totalLate / students.length).toFixed(1) : 0}</div>
                <div class="stat-sub">days/student</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Overall Rate</div>
                <div class="stat-value" style="color:${parseFloat(overallRate) >= 90 ? '#10b981' : parseFloat(overallRate) >= 75 ? '#f59e0b' : '#ef4444'}">${overallRate}%</div>
                <div class="stat-sub">attendance</div>
              </div>
            </div>

            <div class="table-section">
              <div class="section-title"><span class="dot"></span> Student-wise Attendance Summary</div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th style="width:5%;text-align:center">#</th>
                    <th style="width:30%">Student</th>
                    <th style="width:13%;text-align:center">Present</th>
                    <th style="width:13%;text-align:center">Late</th>
                    <th style="width:13%;text-align:center">Absent</th>
                    <th style="width:16%;text-align:center">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentRows}
                </tbody>
              </table>
            </div>

            <div class="footer">
              <div class="footer-text">
                Auto-generated by Presence System<br/>
                ${getCategoryLabel(selectedCategory)} • ${formatDate(thirtyDaysAgo)} — ${formatDate(today)} • ${students.length} students
              </div>
              <button class="print-btn" onclick="window.print()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print Report
              </button>
            </div>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
      toast({ title: 'Report Generated', description: `${getCategoryLabel(selectedCategory)} report opened in new tab.` });
    } catch (error) {
      console.error('Error generating class report:', error);
      toast({ title: 'Error', description: 'Failed to generate report.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="bg-card border-border shadow-lg">
      <CardHeader className="pb-4 border-b border-border bg-gradient-to-r from-indigo-600 to-violet-600">
        <CardTitle className="flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span>Class-wise Report</span>
            <p className="text-sm font-normal text-white/70">Print attendance by class & section</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div>
          <Label className="mb-2 block">Select Class & Section</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Choose class-section..." />
            </SelectTrigger>
            <SelectContent>
              {ALL_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={generateClassReport}
          disabled={isGenerating || !selectedCategory}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Printer className="w-4 h-4 mr-2" />
              Print Class Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ClassSectionReport;

import * as XLSX from 'xlsx';
import { toast } from 'sonner';

// Generate course report with attendance data
export async function generateCourseReport(courseId: string, courseName: string) {
    try {
        // Import services dynamically to avoid circular dependencies
        const { getCourse } = await import('./courses-service');
        const { getEnrollmentsByCourse } = await import('./enrollments-service');
        const { supabase } = await import('../supabase');

        // Fetch course details
        const course = await getCourse(courseId);
        if (!course) {
            toast.error('Course not found');
            return;
        }

        // Fetch enrolled students
        const enrollments = await getEnrollmentsByCourse(courseId);

        // Fetch lectures for this course
        const { data: lectures } = await supabase
            .from('lectures')
            .select('id, date, time_start, time_end, status')
            .eq('course_id', courseId)
            .order('date', { ascending: true });

        // Fetch attendance data
        const studentAttendanceData = await Promise.all(
            enrollments.map(async (enrollment) => {
                const studentId = enrollment.student_id;
                const studentName = enrollment.student?.full_name || 'Unknown';
                const studentEmail = enrollment.student?.email || 'N/A';

                // Get attendance records for this student
                const { data: attendanceRecords } = await supabase
                    .from('lecture_attendance')
                    .select('lecture_id, status')
                    .eq('student_id', studentId)
                    .in('lecture_id', (lectures || []).map(l => l.id));

                const totalLectures = lectures?.length || 0;
                const presentCount = attendanceRecords?.filter(a =>
                    a.status === 'present' || a.status === 'late' || a.status === 'excused'
                ).length || 0;
                const absentCount = attendanceRecords?.filter(a => a.status === 'absent').length || 0;
                const leavesCount = attendanceRecords?.filter(a => a.status === 'leave').length || 0;
                const percentage = totalLectures > 0 ? Math.round((presentCount / totalLectures) * 100) : 0;

                return {
                    'Student ID': studentId.slice(0, 8),
                    'Student Name': studentName,
                    'Email': studentEmail,
                    'Total Lectures': totalLectures,
                    'Present': presentCount,
                    'Absent': absentCount,
                    'Leaves': leavesCount,
                    'Attendance %': percentage
                };
            })
        );

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Sheet 1: Course Information
        const courseInfo = [
            ['Course Report'],
            [],
            ['Course Code', course.code],
            ['Course Name', course.name],
            ['Instructor', course.instructor?.full_name || 'Unassigned'],
            ['Discipline', course.discipline?.name || 'N/A'],
            ['Semester', course.semester],
            ['Section', course.section || 'N/A'],
            ['Credit Hours', course.credit_hours],
            ['Total Enrolled Students', enrollments.length],
            ['Total Lectures Conducted', lectures?.length || 0],
            [],
            ['Report Generated', new Date().toLocaleString()]
        ];
        const ws_info = XLSX.utils.aoa_to_sheet(courseInfo);
        XLSX.utils.book_append_sheet(wb, ws_info, 'Course Info');

        // Sheet 2: Student Attendance
        const ws_attendance = XLSX.utils.json_to_sheet(studentAttendanceData);
        XLSX.utils.book_append_sheet(wb, ws_attendance, 'Student Attendance');

        // Sheet 3: Lecture Details
        const lectureDetails = (lectures || []).map(lecture => ({
            'Date': new Date(lecture.date).toLocaleDateString(),
            'Start Time': lecture.time_start,
            'End Time': lecture.time_end,
            'Status': lecture.status
        }));
        const ws_lectures = XLSX.utils.json_to_sheet(lectureDetails);
        XLSX.utils.book_append_sheet(wb, ws_lectures, 'Lecture Details');

        // Sheet 4: Statistics
        const avgAttendance = studentAttendanceData.length > 0
            ? Math.round(studentAttendanceData.reduce((sum, s) => sum + s['Attendance %'], 0) / studentAttendanceData.length)
            : 0;

        const lowAttendanceStudents = studentAttendanceData.filter(s => s['Attendance %'] < 75).length;

        const statistics = [
            ['Course Statistics'],
            [],
            ['Total Students', enrollments.length],
            ['Total Lectures', lectures?.length || 0],
            ['Average Attendance %', avgAttendance],
            ['Students with Low Attendance (<75%)', lowAttendanceStudents],
            ['Students with Good Attendance (>=75%)', enrollments.length - lowAttendanceStudents]
        ];
        const ws_stats = XLSX.utils.aoa_to_sheet(statistics);
        XLSX.utils.book_append_sheet(wb, ws_stats, 'Statistics');

        // Generate filename
        const filename = `${course.code}_${course.name.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Write file
        XLSX.writeFile(wb, filename);

        toast.success(`Report generated: ${filename}`);
    } catch (error) {
        console.error('Error generating course report:', error);
        toast.error('Failed to generate course report');
    }
}

// Generate multiple course reports
export async function generateMultipleCourseReports(courseIds: string[]) {
    for (const courseId of courseIds) {
        await generateCourseReport(courseId, `Course ${courseId.slice(0, 8)}`);
    }
}

// Generate department-wide report
export async function generateDepartmentReport(departmentId: string, departmentName: string) {
    try {
        const { supabase } = await import('../supabase');

        // Get all courses in department
        const { data: courses } = await supabase
            .from('courses')
            .select(`
        id,
        code,
        name,
        semester,
        section,
        credit_hours,
        discipline:disciplines(name, department_id)
      `)
            .eq('discipline.department_id', departmentId);

        if (!courses || courses.length === 0) {
            toast.info('No courses found for this department');
            return;
        }

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Department overview
        const deptInfo = [
            ['Department Report'],
            [],
            ['Department', departmentName],
            ['Total Courses', courses.length],
            ['Report Generated', new Date().toLocaleString()]
        ];
        const ws_info = XLSX.utils.aoa_to_sheet(deptInfo);
        XLSX.utils.book_append_sheet(wb, ws_info, 'Department Info');

        // Courses list
        const coursesList = courses.map((c: any) => ({
            'Course Code': c.code,
            'Course Name': c.name,
            'Discipline': c.discipline?.name || 'N/A',
            'Semester': c.semester,
            'Section': c.section || 'N/A',
            'Credit Hours': c.credit_hours
        }));
        const ws_courses = XLSX.utils.json_to_sheet(coursesList);
        XLSX.utils.book_append_sheet(wb, ws_courses, 'Courses');

        const filename = `${departmentName.replace(/\s+/g, '_')}_Department_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);

        toast.success(`Department report generated: ${filename}`);
    } catch (error) {
        console.error('Error generating department report:', error);
        toast.error('Failed to generate department report');
    }
}

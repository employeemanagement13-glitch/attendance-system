import { supabase } from '../supabase';
import { toast } from 'sonner';

export type Grade = {
    id: string;
    student_id: string;
    course_id: string;
    semester: number;
    midterm_marks: number | null;
    final_marks: number | null;
    assignment_marks: number | null;
    quiz_marks: number | null;
    total_marks: number | null;
    grade_letter: string | null;
    grade_points: number | null;
    created_at: string;
    updated_at: string;
};

export type GradeWithDetails = Grade & {
    student?: { id: string; full_name: string; email: string };
    course?: { id: string; code: string; name: string; credit_hours: number };
};

export type CreateGradeInput = {
    student_id: string;
    course_id: string;
    semester: number;
    midterm_marks?: number;
    final_marks?: number;
    assignment_marks?: number;
    quiz_marks?: number;
};

export type UpdateGradeInput = Partial<CreateGradeInput>;

// Grade mapping for letter grades
const GRADE_MAPPING = {
    'A+': 4.0,
    'A': 3.7,
    'B+': 3.3,
    'B': 3.0,
    'C+': 2.7,
    'C': 2.3,
    'D': 2.0,
    'F': 0.0
};

// Calculate letter grade from percentage
function calculateLetterGrade(percentage: number): { letter: string; points: number } {
    if (percentage >= 90) return { letter: 'A+', points: 4.0 };
    if (percentage >= 85) return { letter: 'A', points: 3.7 };
    if (percentage >= 80) return { letter: 'B+', points: 3.3 };
    if (percentage >= 75) return { letter: 'B', points: 3.0 };
    if (percentage >= 70) return { letter: 'C+', points: 2.7 };
    if (percentage >= 60) return { letter: 'C', points: 2.3 };
    if (percentage >= 50) return { letter: 'D', points: 2.0 };
    return { letter: 'F', points: 0.0 };
}

// Get all grades with filters
export async function getGrades(filters?: {
    student_id?: string;
    course_id?: string;
    semester?: number;
}): Promise<GradeWithDetails[]> {
    let query = supabase
        .from('student_course_grades')
        .select(`
      *,
      student:users!student_id(id, full_name, email),
      course:courses!course_id(id, code, name, credit_hours)
    `)
        .order('semester', { ascending: false });

    if (filters?.student_id) {
        query = query.eq('student_id', filters.student_id);
    }
    if (filters?.course_id) {
        query = query.eq('course_id', filters.course_id);
    }
    if (filters?.semester) {
        query = query.eq('semester', filters.semester);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching grades:', error);
        toast.error('Failed to load grades');
        return [];
    }

    return data || [];
}

// Get student grades
export async function getStudentGrades(studentId: string, semester?: number): Promise<GradeWithDetails[]> {
    return getGrades({ student_id: studentId, semester });
}

// Get course grades
export async function getCourseGrades(courseId: string): Promise<GradeWithDetails[]> {
    return getGrades({ course_id: courseId });
}

// Create or update grade
export async function upsertGrade(input: CreateGradeInput): Promise<Grade | null> {
    try {
        // Calculate total marks
        const midterm = input.midterm_marks || 0;
        const final = input.final_marks || 0;
        const assignment = input.assignment_marks || 0;
        const quiz = input.quiz_marks || 0;

        // Assuming: Midterm 30%, Finals 40%, Assignments 20%, Quizzes 10%
        const total = midterm + final + assignment + quiz;
        const percentage = total > 0 ? Math.round((total / 100) * 100) : 0;

        const gradeInfo = calculateLetterGrade(percentage);

        const gradeData = {
            ...input,
            total_marks: total,
            grade_letter: gradeInfo.letter,
            grade_points: gradeInfo.points,
            updated_at: new Date().toISOString()
        };

        // Check if grade already exists
        const { data: existing } = await supabase
            .from('student_course_grades')
            .select('id')
            .eq('student_id', input.student_id)
            .eq('course_id', input.course_id)
            .eq('semester', input.semester)
            .maybeSingle();

        let result;
        if (existing) {
            // Update existing grade
            const { data, error } = await supabase
                .from('student_course_grades')
                .update(gradeData)
                .eq('id', existing.id)
                .select()
                .maybeSingle();

            if (error) throw error;
            result = data;
            toast.success('Grade updated successfully');
        } else {
            // Insert new grade
            const { data, error } = await supabase
                .from('student_course_grades')
                .insert([gradeData])
                .select()
                .maybeSingle();

            if (error) throw error;
            result = data;
            toast.success('Grade created successfully');
        }

        // Update student's overall GPA
        await updateStudentGPA(input.student_id, input.semester);

        return result;
    } catch (error) {
        console.error('Error upserting grade:', error);
        toast.error('Failed to save grade');
        return null;
    }
}

// Calculate semester GPA for a student
export async function calculateSemesterGPA(studentId: string, semester: number): Promise<number> {
    const grades = await getStudentGrades(studentId, semester);

    if (grades.length === 0) return 0;

    let totalPoints = 0;
    let totalCredits = 0;

    for (const grade of grades) {
        const creditHours = grade.course?.credit_hours || 0;
        const gradePoints = grade.grade_points || 0;

        totalPoints += gradePoints * creditHours;
        totalCredits += creditHours;
    }

    return totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
}

// Calculate cumulative GPA (CGPA) for a student
export async function calculateCGPA(studentId: string): Promise<number> {
    const allGrades = await getStudentGrades(studentId);

    if (allGrades.length === 0) return 0;

    let totalPoints = 0;
    let totalCredits = 0;

    for (const grade of allGrades) {
        const creditHours = grade.course?.credit_hours || 0;
        const gradePoints = grade.grade_points || 0;

        totalPoints += gradePoints * creditHours;
        totalCredits += creditHours;
    }

    return totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
}

// Update student's GPA in users table
async function updateStudentGPA(studentId: string, semester: number): Promise<void> {
    try {
        const semesterGPA = await calculateSemesterGPA(studentId, semester);
        const cgpa = await calculateCGPA(studentId);

        // Update users table
        await supabase
            .from('users')
            .update({
                gpa: semesterGPA,
                cgpa: cgpa,
                updated_at: new Date().toISOString()
            })
            .eq('id', studentId);

        // Update or create semester_gpa record
        const { data: existing } = await supabase
            .from('semester_gpa')
            .select('id')
            .eq('student_id', studentId)
            .eq('semester', semester)
            .maybeSingle();

        // Get total credit hours for semester
        const grades = await getStudentGrades(studentId, semester);
        const totalCreditHours = grades.reduce((sum, g) => sum + (g.course?.credit_hours || 0), 0);

        if (existing) {
            await supabase
                .from('semester_gpa')
                .update({
                    gpa: semesterGPA,
                    cgpa: cgpa,
                    total_credit_hours: totalCreditHours,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('semester_gpa')
                .insert([{
                    student_id: studentId,
                    semester: semester,
                    gpa: semesterGPA,
                    cgpa: cgpa,
                    total_credit_hours: totalCreditHours
                }]);
        }
    } catch (error) {
        console.error('Error updating student GPA:', error);
    }
}

// Delete grade
export async function deleteGrade(id: string): Promise<boolean> {
    try {
        // Get grade info before deleting to update GPA
        const { data: grade } = await supabase
            .from('student_course_grades')
            .select('student_id, semester')
            .eq('id', id)
            .single();

        const { error } = await supabase
            .from('student_course_grades')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Update GPA after deletion
        if (grade) {
            await updateStudentGPA(grade.student_id, grade.semester);
        }

        toast.success('Grade deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting grade:', error);
        toast.error('Failed to delete grade');
        return false;
    }
}

// Get student transcript
export async function getStudentTranscript(studentId: string): Promise<any> {
    const allGrades = await getStudentGrades(studentId);
    const cgpa = await calculateCGPA(studentId);

    // Group by semester
    const semesters = new Map<number, typeof allGrades>();

    for (const grade of allGrades) {
        if (!semesters.has(grade.semester)) {
            semesters.set(grade.semester, []);
        }
        semesters.get(grade.semester)!.push(grade);
    }

    const transcript = [];
    for (const [sem, grades] of semesters.entries()) {
        const semGPA = await calculateSemesterGPA(studentId, sem);
        transcript.push({
            semester: sem,
            gpa: semGPA,
            courses: grades
        });
    }

    return {
        student_id: studentId,
        cgpa,
        semesters: transcript
    };
}

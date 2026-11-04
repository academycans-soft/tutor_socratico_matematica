import { TUTOR_API_BASE_URL } from '$lib/constants';

export interface Assignment {
	id: string;
	course_id: string;
	course_title?: string;
	classroom_id: string;
	classroom_name?: string;
	teacher_id: string;
	teacher_name?: string;
	title: string;
	description?: string;
	due_date?: string;
	points: number;
	enable_ai_grading: boolean;
	status: string;
	submission_count?: number;
	created_at: string;
	updated_at?: string;
	my_submission?: Submission;
}

export interface Submission {
	id: string;
	assignment_id: string;
	assignment_title?: string;
	student_id: string;
	student_name?: string;
	student_email?: string;
	content?: string;
	file_id?: string;
	grade?: number;
	feedback?: string;
	ai_grade?: number;
	ai_feedback?: string;
	status: string;
	submitted_at: string;
	graded_at?: string;
}

export interface AssignmentCreateRequest {
	title: string;
	description?: string;
	course_id: string;
	due_date?: string;
	points?: number;
	enable_ai_grading?: boolean;
	status?: string;
}

export const getAssignments = async (
	token: string,
	courseId?: string,
	classroomId?: string
): Promise<Assignment[]> => {
	let error = null;
	const params = new URLSearchParams();
	if (courseId) params.append('course_id', courseId);
	if (classroomId) params.append('classroom_id', classroomId);

	const url = params.toString()
		? `${TUTOR_API_BASE_URL}/assignments/?${params.toString()}`
		: `${TUTOR_API_BASE_URL}/assignments/`;

	const res = await fetch(url, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to fetch assignments';
			return [];
		});

	if (error) throw error;
	return res;
};

export const createAssignment = async (
	token: string,
	data: AssignmentCreateRequest
): Promise<Assignment> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/assignments/`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(data)
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to create assignment';
			return null;
		});

	if (error) throw error;
	return res;
};

export const getAssignmentById = async (
	token: string,
	assignmentId: string
): Promise<Assignment> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/assignments/${assignmentId}`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to fetch assignment';
			return null;
		});

	if (error) throw error;
	return res;
};

export const submitAssignment = async (
	token: string,
	assignmentId: string,
	content?: string,
	fileId?: string
): Promise<Submission> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/assignments/${assignmentId}/submit`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ content, file_id: fileId })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to submit assignment';
			return null;
		});

	if (error) throw error;
	return res;
};

export const getAssignmentSubmissions = async (
	token: string,
	assignmentId: string
): Promise<Submission[]> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/assignments/${assignmentId}/submissions`, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to fetch submissions';
			return [];
		});

	if (error) throw error;
	return res;
};

export const gradeSubmission = async (
	token: string,
	submissionId: string,
	grade: number,
	feedback?: string
): Promise<Submission> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/assignments/submissions/${submissionId}/grade`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ grade, feedback })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to grade submission';
			return null;
		});

	if (error) throw error;
	return res;
};

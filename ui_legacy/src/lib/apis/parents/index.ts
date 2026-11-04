import { TUTOR_API_BASE_URL } from '$lib/constants';

export interface ChildSummary {
	student_id: string;
	name: string;
	email: string;
	supports_count: number;
	submissions_count: number;
}

export interface ChildProgress {
	student: {
		id: string;
		name: string;
		email: string;
	};
	supports: Array<{
		id: string;
		title: string;
		subject?: string;
		status: string;
		created_at: string;
	}>;
	submissions: Array<{
		id: string;
		assignment_title?: string;
		grade?: number;
		feedback?: string;
		ai_grade?: number;
		ai_feedback?: string;
		status: string;
		submitted_at: string;
	}>;
}

export const getChildren = async (token: string): Promise<ChildSummary[]> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/parents/children`, {
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
			error = err.detail || err.message || 'Failed to fetch children';
			return [];
		});

	if (error) throw error;
	return res;
};

export const linkStudentByEmail = async (
	token: string,
	studentEmail: string
): Promise<any> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/parents/link`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ student_email: studentEmail })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to link student';
			return null;
		});

	if (error) throw error;
	return res;
};

export const getChildProgress = async (
	token: string,
	studentId: string
): Promise<ChildProgress> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/parents/children/${studentId}/progress`, {
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
			error = err.detail || err.message || 'Failed to fetch child progress';
			return null;
		});

	if (error) throw error;
	return res;
};

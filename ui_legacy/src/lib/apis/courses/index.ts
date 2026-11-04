import { TUTOR_API_BASE_URL } from '$lib/constants';

export interface Course {
	id: string;
	title: string;
	description?: string;
	subject?: string;
	classroom_id: string;
	classroom_name?: string;
	teacher_id: string;
	teacher_name?: string;
	level?: string;
	image_url?: string;
	knowledge_id?: string;
	created_at: string;
	updated_at?: string;
}

export interface CourseCreateRequest {
	title: string;
	description?: string;
	subject?: string;
	classroom_id: string;
	level?: string;
	image_url?: string;
}

export const getCourses = async (
	token: string,
	classroomId?: string
): Promise<Course[]> => {
	let error = null;
	const url = classroomId
		? `${TUTOR_API_BASE_URL}/courses/?classroom_id=${classroomId}`
		: `${TUTOR_API_BASE_URL}/courses/`;

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
			error = err.detail || err.message || 'Failed to fetch courses';
			return [];
		});

	if (error) throw error;
	return res;
};

export const createCourse = async (
	token: string,
	data: CourseCreateRequest
): Promise<Course> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/courses/`, {
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
			error = err.detail || err.message || 'Failed to create course';
			return null;
		});

	if (error) throw error;
	return res;
};

export const getCourseById = async (
	token: string,
	courseId: string
): Promise<Course> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/courses/${courseId}`, {
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
			error = err.detail || err.message || 'Failed to fetch course';
			return null;
		});

	if (error) throw error;
	return res;
};

export const deleteCourseById = async (
	token: string,
	courseId: string
): Promise<boolean> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/courses/${courseId}`, {
		method: 'DELETE',
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
			error = err.detail || err.message || 'Failed to delete course';
			return null;
		});

	if (error) throw error;
	return res;
};

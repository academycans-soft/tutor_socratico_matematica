import { TUTOR_API_BASE_URL } from '$lib/constants';

export interface Classroom {
	id: string;
	name: string;
	description?: string;
	code: string;
	teacher_id: string;
	teacher_name?: string;
	member_count?: number;
	created_at: string;
	updated_at?: string;
	members?: Array<{
		id: string;
		user_id: string;
		user_name: string;
		user_email: string;
		role: string;
		joined_at: string;
	}>;
}

export interface ClassroomCreateRequest {
	name: string;
	description?: string;
}

export const getClassrooms = async (token: string): Promise<Classroom[]> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/classrooms/`, {
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
			error = err.detail || err.message || 'Failed to fetch classrooms';
			return [];
		});

	if (error) throw error;
	return res;
};

export const createClassroom = async (
	token: string,
	data: ClassroomCreateRequest
): Promise<Classroom> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/classrooms/`, {
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
			error = err.detail || err.message || 'Failed to create classroom';
			return null;
		});

	if (error) throw error;
	return res;
};

export const joinClassroom = async (token: string, code: string): Promise<Classroom> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/classrooms/join`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ code })
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail || err.message || 'Failed to join classroom';
			return null;
		});

	if (error) throw error;
	return res;
};

export const getClassroomById = async (token: string, classroomId: string): Promise<Classroom> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/classrooms/${classroomId}`, {
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
			error = err.detail || err.message || 'Failed to fetch classroom';
			return null;
		});

	if (error) throw error;
	return res;
};

export const deleteClassroomById = async (token: string, classroomId: string): Promise<boolean> => {
	let error = null;
	const res = await fetch(`${TUTOR_API_BASE_URL}/classrooms/${classroomId}`, {
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
			error = err.detail || err.message || 'Failed to delete classroom';
			return null;
		});

	if (error) throw error;
	return res;
};

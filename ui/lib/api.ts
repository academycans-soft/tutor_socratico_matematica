/**
 * API client for Open TutorAI LMS.
 */

const BASE_URL = typeof window !== 'undefined' ? '' : 'http://localhost:8080';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tutorai_token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tutorai_token', token);
  }
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('tutorai_token');
    localStorage.removeItem('tutorai_user');
  }
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('tutorai_user');
  return u ? JSON.parse(u) : null;
}

export function setUser(user: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tutorai_user', JSON.stringify(user));
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (netErr: any) {
    throw new Error(`Error de red: no se pudo comunicar con el servidor (${netErr.message || 'Sin conexión'}).`);
  }

  if (!response.ok) {
    let errorDetail = `Request failed: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch (_) {}

    // Clean session expiration handling: auto-redirect on 401 Unauthorized
    if (response.status === 401) {
      removeToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=true';
      }
    }

    throw new Error(errorDetail);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 80)}`);
  }

  return response.json();
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const data = await request<{ token: string; user?: any; id?: string; email?: string; name?: string; role?: string }>('/api/v1/auths/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setToken(data.token);
      const user = data.user || {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
      };
      setUser(user);
    }
    return data;
  },

  async getSession() {
    return request<any>('/api/v1/auths/');
  },

  // Curriculum
  async getRoadmap() {
    return request<any[]>('/api/v1/curriculum/roadmap');
  },

  async getTopic(code: string) {
    return request<any>(`/api/v1/curriculum/topics/${code}`);
  },

  async createTopic(payload: any) {
    return request<any>('/api/v1/curriculum/topics', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTopic(code: string, payload: any) {
    return request<any>(`/api/v1/curriculum/topics/${code}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteTopic(code: string) {
    return request<any>(`/api/v1/curriculum/topics/${code}`, {
      method: 'DELETE',
    });
  },

  async createUnit(payload: { grade_id: string; title: string; description?: string; trimester?: number; order_index?: number }) {
    return request<any>('/api/v1/curriculum/units', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateUnit(unitId: string, payload: { title?: string; description?: string; trimester?: number; order_index?: number }) {
    return request<any>(`/api/v1/curriculum/units/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteUnit(unitId: string) {
    return request<any>(`/api/v1/curriculum/units/${unitId}`, {
      method: 'DELETE',
    });
  },

  // Math LMS
  async getStudentProgress() {
    return request<{
      user_id: string;
      topics: Record<string, {
        topic_code: string;
        average_domain_d: number;
        active_stage: string;
        active_scene: string;
        current_level: string;
        is_mastered: boolean;
        completed: boolean;
      }>;
      overall_average_d: number;
      completed_count: number;
      total_explored_topics: number;
    }>('/api/v1/math/student/progress');
  },

  async markTopicCompleted(code: string) {
    return request<any>(`/api/v1/math/topics/${code}/complete`, {
      method: 'POST',
    });
  },

  async resetTopic(code: string) {
    return request<any>(`/api/v1/math/topics/${code}/reset`, {
      method: 'POST',
    });
  },


  async getTopicState(code: string) {
    return request<any>(`/api/v1/math/topics/${code}/state`);
  },

  async advanceScene(code: string, stage: string, scene: string) {
    return request<any>(`/api/v1/math/topics/${code}/scene`, {
      method: 'POST',
      body: JSON.stringify({ stage, scene }),
    });
  },

  async submitHypothesis(code: string, hypothesis: string) {
    return request<any>(`/api/v1/math/topics/${code}/conecta/hypothesis`, {
      method: 'POST',
      body: JSON.stringify({ hypothesis }),
    });
  },

  async submitMicrocheck(code: string, answers: Record<string, string>) {
    return request<any>(`/api/v1/math/topics/${code}/microcheck`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  async getCurrentExercise(code: string) {
    return request<any>(`/api/v1/math/topics/${code}/exercise/current`);
  },

  async submitExercise(code: string, exerciseId: string, answer: string, hintsUsed: number = 0) {
    return request<any>(`/api/v1/math/topics/${code}/exercise/submit`, {
      method: 'POST',
      body: JSON.stringify({
        exercise_id: exerciseId,
        student_answer: answer,
        hints_used: hintsUsed,
      }),
    });
  },

  async sendChatMessage(code: string, message: string, context?: any) {
    return request<{ reply: string; stage: string; scene: string; action?: any }>(`/api/v1/math/topics/${code}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  },

  async getProactiveIntervention(
    code: string,
    eventType: string,
    eventPayload: any = {},
    context?: any
  ) {
    return request<{
      reply: string;
      stage: string;
      scene: string;
      action?: any;
      suggested_prompts?: string[];
    }>(`/api/v1/math/topics/${code}/proactive-intervention`, {
      method: 'POST',
      body: JSON.stringify({
        event_type: eventType,
        event_payload: eventPayload,
        context,
      }),
    });
  },

  // Teacher Analytics
  async getTeacherSummary(classroomId: string, topicCode: string = 'MATH-PITAGORAS') {
    return request<any>(`/api/v1/math/teacher/${classroomId}/summary?topic_code=${topicCode}`);
  },

  async getTeacherMatrix(classroomId: string, topicCode: string = 'MATH-PITAGORAS') {
    return request<any>(`/api/v1/math/teacher/${classroomId}/matrix?topic_code=${topicCode}`);
  },

  // Socratic Tutor Model Config
  async getTutorModel() {
    return request<{ current_model: string; available_models: { id: string; name: string }[] }>('/api/v1/math/tutor/model');
  },

  async updateTutorModel(model: string) {
    return request<{ status: string; current_model: string }>('/api/v1/math/tutor/model', {
      method: 'POST',
      body: JSON.stringify({ model }),
    });
  },

  // Admin & User Management
  async getUsers() {
    return request<any[]>('/api/v1/users');
  },

  async createUser(data: { name: string; email: string; password: string; role?: string; profile_image_url?: string }) {
    return request<any>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUserRole(id: string, role: string) {
    return request<any>('/api/v1/users/update/role', {
      method: 'POST',
      body: JSON.stringify({ id, role }),
    });
  },

  async updateUser(id: string, data: { name?: string; email?: string; role?: string; is_active?: boolean }) {
    return request<any>(`/api/v1/users/${id}/update`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string) {
    return request<any>(`/api/v1/users/${id}`, {
      method: 'DELETE',
    });
  },

  async getClassrooms() {
    return request<any[]>('/api/v1/classrooms');
  },

  async getClassroomRoster(id: string) {
    return request<any>(`/api/v1/classrooms/${id}`);
  },

  async createClassroom(data: { name: string; description?: string; grade_id?: string }) {
    return request<any>('/api/v1/classrooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateClassroom(id: string, data: { name?: string; description?: string; grade_id?: string }) {
    return request<any>(`/api/v1/classrooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteClassroom(id: string) {
    return request<any>(`/api/v1/classrooms/${id}`, {
      method: 'DELETE',
    });
  },

  async enrollStudent(classroomId: string, userId: string) {
    return request<any>(`/api/v1/classrooms/${classroomId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  async removeStudent(classroomId: string, userId: string) {
    return request<any>(`/api/v1/classrooms/${classroomId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  async joinClassroom(code: string) {
    return request<any>('/api/v1/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async getAdminSettings() {
    return request<any>('/api/v1/math/admin/settings');
  },

  async updateAdminSettings(settings: any) {
    return request<any>('/api/v1/math/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Units Management
  async listUnits(gradeId?: string) {
    const q = gradeId ? `?grade_id=${gradeId}` : '';
    return request<any[]>(`/api/v1/curriculum/units${q}`);
  },



  // AI Curriculum Generation & Staging Copilot
  async generateTopicAI(payload: {
    title: string;
    grade_level: string;
    unit_id?: string;
    unit_title?: string;
    description?: string;
    prerequisites?: string[];
    objectives?: string[];
  }) {
    return request<{ topic: any; staged_content: any }>('/api/v1/curriculum/topics/generate-ai', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async refineTopicAI(code: string, instruction: string, modelId?: string) {
    return request<{ topic: any; staged_content: any }>(`/api/v1/curriculum/topics/${code}/refine-ai`, {
      method: 'POST',
      body: JSON.stringify({ instruction, model_id: modelId }),
    });
  },

  async approveTopic(code: string) {
    return request<{ topic: any; status: string; message: string }>(`/api/v1/curriculum/topics/${code}/approve`, {
      method: 'POST',
    });
  },

  // Real-time Infinite Practice
  async getRealtimeExercise(code: string) {
    return request<any>(`/api/v1/math/topics/${code}/exercise/realtime`);
  },

  async submitRealtimeExercise(code: string, exercise: any, studentAnswer: string, hintsUsed: number = 0) {
    return request<{ is_correct: boolean; correct_answer: string; unit?: string; solution_steps?: string[]; feedback: string }>(
      `/api/v1/math/topics/${code}/exercise/realtime/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          exercise,
          student_answer: studentAnswer,
          hints_used: hintsUsed,
        }),
      }
    );
  },
};

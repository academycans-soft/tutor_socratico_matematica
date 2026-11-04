<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { user } from '$lib/stores';
	import {
		getClassrooms,
		createClassroom,
		getClassroomById,
		deleteClassroomById,
		type Classroom
	} from '$lib/apis/classrooms';
	import {
		getCourses,
		createCourse,
		deleteCourseById,
		type Course
	} from '$lib/apis/courses';
	import {
		getAssignments,
		createAssignment,
		getAssignmentSubmissions,
		gradeSubmission,
		type Assignment,
		type Submission
	} from '$lib/apis/assignments';
	import {
		getKnowledgeById,
		addFileToKnowledgeById,
		removeFileFromKnowledgeById,
		createNewKnowledge
	} from '$lib/apis/knowledge';
	import { uploadFile } from '$lib/apis/files';
	import { processFile } from '$lib/apis/retrieval';

	const i18n = getContext('i18n');

	let activeTab: 'classrooms' | 'courses' | 'assignments' = 'classrooms';
	let loading = true;

	// Classrooms
	let classrooms: Classroom[] = [];
	let showCreateClassroomModal = false;
	let newClassroomName = '';
	let newClassroomDesc = '';
	let selectedRosterClassroom: Classroom | null = null;

	// Courses
	let courses: Course[] = [];
	let showCreateCourseModal = false;
	let newCourseTitle = '';
	let newCourseSubject = '';
	let newCourseClassroomId = '';
	let newCourseLevel = 'Beginner';
	let newCourseDesc = '';

	// Assignments
	let assignments: Assignment[] = [];
	let showCreateAssignmentModal = false;
	let newAssignmentTitle = '';
	let newAssignmentCourseId = '';
	let newAssignmentDueDate = '';
	let newAssignmentPoints = 100;
	let newAssignmentAiGrading = true;
	let newAssignmentDesc = '';

	// Grading modal
	let selectedAssignmentForGrading: Assignment | null = null;
	let submissionsList: Submission[] = [];
	let selectedSubmission: Submission | null = null;
	let gradeInput = 100;
	let feedbackInput = '';
	// Knowledge Modal State
	let selectedCourseForKnowledge: Course | null = null;
	let courseKnowledgeData: any = null;
	let loadingKnowledge = false;
	let uploadingKnowledgeFile = false;
	let knowledgeFileInput: HTMLInputElement | null = null;

	let gradingSaving = false;

	onMount(async () => {
		if (!$user) {
			goto('/auth');
			return;
		}

		if ($user.role !== 'teacher' && !$user.is_admin) {
			toast.error($i18n.t('Teacher access required'));
			goto('/');
			return;
		}

		await refreshAll();
	});

	async function refreshAll() {
		loading = true;
		try {
			const token = localStorage.getItem('token') || '';
			const [cls, crs, asg] = await Promise.all([
				getClassrooms(token),
				getCourses(token),
				getAssignments(token)
			]);
			classrooms = cls;
			courses = crs;
			assignments = asg;
			if (classrooms.length > 0 && !newCourseClassroomId) {
				newCourseClassroomId = classrooms[0].id;
			}
			if (courses.length > 0 && !newAssignmentCourseId) {
				newAssignmentCourseId = courses[0].id;
			}
		} catch (err: any) {
			console.error('Error refreshing teacher dashboard:', err);
		} finally {
			loading = false;
		}
	}

	async function handleCreateClassroom() {
		if (!newClassroomName.trim()) {
			toast.error($i18n.t('Please enter classroom name'));
			return;
		}
		try {
			const token = localStorage.getItem('token') || '';
			const res = await createClassroom(token, {
				name: newClassroomName.trim(),
				description: newClassroomDesc.trim() || undefined
			});
			toast.success($i18n.t('Classroom created! Share code: ') + res.code);
			newClassroomName = '';
			newClassroomDesc = '';
			showCreateClassroomModal = false;
			await refreshAll();
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Failed to create classroom'));
		}
	}

	async function viewRoster(c: Classroom) {
		try {
			const token = localStorage.getItem('token') || '';
			selectedRosterClassroom = await getClassroomById(token, c.id);
		} catch (err: any) {
			toast.error($i18n.t('Failed to load roster'));
		}
	}

	async function handleCreateCourse() {
		if (!newCourseTitle.trim() || !newCourseClassroomId) {
			toast.error($i18n.t('Please fill in title and select classroom'));
			return;
		}
		try {
			const token = localStorage.getItem('token') || '';
			await createCourse(token, {
				title: newCourseTitle.trim(),
				subject: newCourseSubject.trim() || undefined,
				classroom_id: newCourseClassroomId,
				level: newCourseLevel,
				description: newCourseDesc.trim() || undefined
			});
			toast.success($i18n.t('Course created successfully'));
			newCourseTitle = '';
			newCourseSubject = '';
			newCourseDesc = '';
			showCreateCourseModal = false;
			await refreshAll();
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Failed to create course'));
		}
	}

	async function handleCreateAssignment() {
		if (!newAssignmentTitle.trim() || !newAssignmentCourseId) {
			toast.error($i18n.t('Please fill in assignment title and course'));
			return;
		}
		try {
			const token = localStorage.getItem('token') || '';
			await createAssignment(token, {
				title: newAssignmentTitle.trim(),
				course_id: newAssignmentCourseId,
				description: newAssignmentDesc.trim() || undefined,
				due_date: newAssignmentDueDate.trim() || undefined,
				points: Number(newAssignmentPoints) || 100,
				enable_ai_grading: newAssignmentAiGrading
			});
			toast.success($i18n.t('Assignment published!'));
			newAssignmentTitle = '';
			newAssignmentDesc = '';
			showCreateAssignmentModal = false;
			await refreshAll();
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Failed to create assignment'));
		}
	}

	async function openGrading(assignment: Assignment) {
		selectedAssignmentForGrading = assignment;
		try {
			const token = localStorage.getItem('token') || '';
			submissionsList = await getAssignmentSubmissions(token, assignment.id);
		} catch (err: any) {
			toast.error($i18n.t('Failed to load submissions'));
		}
	}

	function selectSubmissionForGrade(sub: Submission) {
		selectedSubmission = sub;
		gradeInput = sub.grade !== null && sub.grade !== undefined ? sub.grade : (sub.ai_grade ?? 100);
		feedbackInput = sub.feedback || sub.ai_feedback || '';
	}

	async function saveGrade() {
		if (!selectedSubmission) return;
		gradingSaving = true;
		try {
			const token = localStorage.getItem('token') || '';
			await gradeSubmission(token, selectedSubmission.id, gradeInput, feedbackInput.trim());
			toast.success($i18n.t('Grade & feedback saved!'));
			selectedSubmission = null;
			if (selectedAssignmentForGrading) {
				submissionsList = await getAssignmentSubmissions(token, selectedAssignmentForGrading.id);
			}
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Failed to save grade'));
		} finally {
			gradingSaving = false;
		}
	}

	async function openCourseKnowledge(course: Course) {
		selectedCourseForKnowledge = course;
		loadingKnowledge = true;
		courseKnowledgeData = null;
		try {
			const token = localStorage.getItem('token') || '';
			let kbId = course.knowledge_id;
			if (!kbId) {
				// Create knowledge base if course didn't have one previously
				const newKb = await createNewKnowledge(
					token,
					`${course.title} - Base de Conocimiento`,
					`Base de conocimiento para ${course.title}`,
					null
				);
				if (newKb && newKb.id) {
					kbId = newKb.id;
					course.knowledge_id = kbId;
				}
			}

			if (kbId) {
				courseKnowledgeData = await getKnowledgeById(token, kbId);
			}
		} catch (err: any) {
			console.error('Error loading course knowledge:', err);
			toast.error(err.detail || $i18n.t('Failed to load knowledge base'));
		} finally {
			loadingKnowledge = false;
		}
	}

	async function handleUploadKnowledgeFile(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target?.files?.[0];
		if (!file || !selectedCourseForKnowledge || !selectedCourseForKnowledge.knowledge_id) return;

		uploadingKnowledgeFile = true;
		try {
			const token = localStorage.getItem('token') || '';
			const kbId = selectedCourseForKnowledge.knowledge_id;

			// 1. Upload file
			const uploaded = await uploadFile(token, file);
			if (!uploaded || !uploaded.id) {
				throw new Error('Upload failed');
			}

			// 2. Link file to course knowledge base
			await addFileToKnowledgeById(token, kbId, uploaded.id);

			// 3. Trigger background vectorization/processing
			try {
				await processFile(token, uploaded.id, kbId);
			} catch (procErr) {
				console.warn('File processing notice:', procErr);
			}

			toast.success($i18n.t('Document uploaded and indexed successfully!'));
			// Refresh KB view
			courseKnowledgeData = await getKnowledgeById(token, kbId);
		} catch (err: any) {
			console.error('Error uploading file to course knowledge:', err);
			toast.error(err.detail || err.message || $i18n.t('Failed to upload document'));
		} finally {
			uploadingKnowledgeFile = false;
			if (knowledgeFileInput) knowledgeFileInput.value = '';
		}
	}

	async function handleRemoveKnowledgeFile(fileId: string) {
		if (!selectedCourseForKnowledge || !selectedCourseForKnowledge.knowledge_id) return;
		try {
			const token = localStorage.getItem('token') || '';
			const kbId = selectedCourseForKnowledge.knowledge_id;
			await removeFileFromKnowledgeById(token, kbId, fileId);
			toast.success($i18n.t('Document removed from course'));
			courseKnowledgeData = await getKnowledgeById(token, kbId);
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Failed to remove document'));
		}
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-800 gap-4">
			<div>
				<h1 class="text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-3">
					<span>👨‍🏫</span> {$i18n.t('Teacher Control Center')}
				</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					{$i18n.t('Manage your classrooms, design courses, and evaluate student submissions with Tutor AI assistance.')}
				</p>
			</div>

			<div class="flex items-center gap-3">
				<a
					href="/"
					class="px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
				>
					{$i18n.t('Go to Chat')}
				</a>
			</div>
		</div>

		<!-- Navigation Tabs -->
		<div class="flex gap-2 my-6 border-b border-gray-200 dark:border-gray-800">
			<button
				on:click={() => (activeTab = 'classrooms')}
				class="pb-3 px-4 font-semibold text-sm transition border-b-2 {activeTab === 'classrooms' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}"
			>
				{$i18n.t('My Classrooms')} ({classrooms.length})
			</button>
			<button
				on:click={() => (activeTab = 'courses')}
				class="pb-3 px-4 font-semibold text-sm transition border-b-2 {activeTab === 'courses' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}"
			>
				{$i18n.t('Courses')} ({courses.length})
			</button>
			<button
				on:click={() => (activeTab = 'assignments')}
				class="pb-3 px-4 font-semibold text-sm transition border-b-2 {activeTab === 'assignments' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}"
			>
				{$i18n.t('Assignments & Grading')} ({assignments.length})
			</button>
		</div>

		{#if loading}
			<div class="flex justify-center items-center py-20">
				<div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
			</div>

		<!-- TAB 1: CLASSROOMS -->
		{:else if activeTab === 'classrooms'}
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
					{$i18n.t('Active Classrooms')}
				</h2>
				<button
					on:click={() => (showCreateClassroomModal = true)}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
				>
					<span>+</span> {$i18n.t('New Classroom')}
				</button>
			</div>

			{#if classrooms.length === 0}
				<div class="bg-white dark:bg-gray-800 p-10 text-center rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-gray-500 dark:text-gray-400 mb-4">{$i18n.t('You have not created any classrooms yet.')}</p>
					<button
						on:click={() => (showCreateClassroomModal = true)}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
					>
						{$i18n.t('Create First Classroom')}
					</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each classrooms as classroom (classroom.id)}
						<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-between">
							<div>
								<div class="flex justify-between items-start mb-3">
									<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
										{classroom.name}
									</h3>
									<div class="text-right">
										<span class="px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-mono text-xs font-bold rounded">
											{classroom.code}
										</span>
										<span class="block text-[10px] text-gray-400 uppercase mt-0.5">{$i18n.t('Invite Code')}</span>
									</div>
								</div>
								<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
									{classroom.description || $i18n.t('No description')}
								</p>
							</div>

							<div class="pt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
								<span class="text-xs text-gray-500 dark:text-gray-400">
									{$i18n.t('Students enrolled')}: <strong>{classroom.member_count || 0}</strong>
								</span>
								<button
									on:click={() => viewRoster(classroom)}
									class="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
								>
									{$i18n.t('View Roster')} &rarr;
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

		<!-- TAB 2: COURSES -->
		{:else if activeTab === 'courses'}
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
					{$i18n.t('Courses & Curriculum')}
				</h2>
				<button
					on:click={() => (showCreateCourseModal = true)}
					disabled={classrooms.length === 0}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
				>
					<span>+</span> {$i18n.t('New Course')}
				</button>
			</div>

			{#if classrooms.length === 0}
				<div class="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300 mb-6">
					{$i18n.t('Please create a classroom first before adding courses.')}
				</div>
			{/if}

			{#if courses.length === 0}
				<div class="bg-white dark:bg-gray-800 p-10 text-center rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-gray-500 dark:text-gray-400 mb-4">{$i18n.t('No courses created yet.')}</p>
					<button
						on:click={() => (showCreateCourseModal = true)}
						disabled={classrooms.length === 0}
						class="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm"
					>
						{$i18n.t('Create Course')}
					</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each courses as course (course.id)}
						<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-between">
							<div>
								<div class="flex justify-between items-center mb-2">
									<span class="text-xs font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
										{course.subject || 'General'}
									</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">
										{course.level}
									</span>
								</div>
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
									{course.title}
								</h3>
								<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
									{course.description || $i18n.t('No description')}
								</p>
							</div>

							<div class="pt-4 border-t border-gray-100 dark:border-gray-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-gray-500">
								<span>{$i18n.t('Classroom')}: <strong>{course.classroom_name || 'Enrolled group'}</strong></span>
								<button
									on:click={() => openCourseKnowledge(course)}
									class="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg flex items-center gap-1.5 transition"
								>
									<span>📚</span> {$i18n.t('Knowledge & Documents')}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

		<!-- TAB 3: ASSIGNMENTS & GRADING -->
		{:else if activeTab === 'assignments'}
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
					{$i18n.t('Assignments & Student Submissions')}
				</h2>
				<button
					on:click={() => (showCreateAssignmentModal = true)}
					disabled={courses.length === 0}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
				>
					<span>+</span> {$i18n.t('New Assignment')}
				</button>
			</div>

			{#if courses.length === 0}
				<div class="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300 mb-6">
					{$i18n.t('Please create at least one course before creating assignments.')}
				</div>
			{/if}

			{#if assignments.length === 0}
				<div class="bg-white dark:bg-gray-800 p-10 text-center rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-gray-500 dark:text-gray-400">{$i18n.t('No assignments published yet.')}</p>
				</div>
			{:else}
				<div class="grid gap-4">
					{#each assignments as assignment (assignment.id)}
						<div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
							<div>
								<div class="flex items-center gap-2 mb-1">
									<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
										{assignment.title}
									</h3>
									{#if assignment.enable_ai_grading}
										<span class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-medium">
											✨ {$i18n.t('AI Grading')}
										</span>
									{/if}
								</div>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									<span>{$i18n.t('Course')}: <strong>{assignment.course_title}</strong></span>
									<span class="mx-2">•</span>
									<span>{$i18n.t('Max Points')}: <strong>{assignment.points}</strong></span>
									{#if assignment.due_date}
										<span class="mx-2">•</span>
										<span>{$i18n.t('Due')}: <strong>{assignment.due_date}</strong></span>
									{/if}
								</p>
							</div>

							<div class="flex items-center gap-3">
								<button
									on:click={() => openGrading(assignment)}
									class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
								>
									<span>📥</span> {$i18n.t('Review Submissions')}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- MODAL: CREATE CLASSROOM -->
{#if showCreateClassroomModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
			<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
				{$i18n.t('Create New Classroom')}
			</h3>
			<div class="space-y-4 mb-6">
				<div>
					<label for="classroom-name" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Classroom Name')} *
					</label>
					<input
						id="classroom-name"
						type="text"
						bind:value={newClassroomName}
						placeholder="e.g. Physics Section A"
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="classroom-desc" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Description')}
					</label>
					<textarea
						id="classroom-desc"
						bind:value={newClassroomDesc}
						rows="3"
						placeholder="Goals and instructions for the classroom group..."
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					></textarea>
				</div>
			</div>
			<div class="flex justify-end gap-3">
				<button
					on:click={() => (showCreateClassroomModal = false)}
					class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
				>
					{$i18n.t('Cancel')}
				</button>
				<button
					on:click={handleCreateClassroom}
					class="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
				>
					{$i18n.t('Create & Generate Code')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: ROSTER -->
{#if selectedRosterClassroom}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
			<div class="flex justify-between items-center mb-4">
				<div>
					<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
						{selectedRosterClassroom.name} — {$i18n.t('Student Roster')}
					</h3>
					<span class="text-xs font-mono bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
						{$i18n.t('Code')}: {selectedRosterClassroom.code}
					</span>
				</div>
				<button on:click={() => (selectedRosterClassroom = null)} class="text-gray-400 hover:text-gray-200">
					&times;
				</button>
			</div>

			<div class="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 mb-4">
				{#if !selectedRosterClassroom.members || selectedRosterClassroom.members.length === 0}
					<p class="text-sm text-gray-500 py-4 text-center">
						{$i18n.t('No students have joined with this code yet.')}
					</p>
				{:else}
					{#each selectedRosterClassroom.members as member}
						<div class="py-2.5 flex items-center justify-between text-sm">
							<div>
								<div class="font-medium text-gray-900 dark:text-gray-100">{member.user_name}</div>
								<div class="text-xs text-gray-500">{member.user_email}</div>
							</div>
							<span class="text-xs text-gray-400">{member.role}</span>
						</div>
					{/each}
				{/if}
			</div>

			<div class="flex justify-end">
				<button
					on:click={() => (selectedRosterClassroom = null)}
					class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm"
				>
					{$i18n.t('Close')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: CREATE COURSE -->
{#if showCreateCourseModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
			<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
				{$i18n.t('Create New Course')}
			</h3>
			<div class="space-y-4 mb-6">
				<div>
					<label for="course-title" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Course Title')} *
					</label>
					<input
						id="course-title"
						type="text"
						bind:value={newCourseTitle}
						placeholder="e.g. Introduction to Mechanics"
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="course-classroom" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Assign to Classroom')} *
					</label>
					<select
						id="course-classroom"
						bind:value={newCourseClassroomId}
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					>
						{#each classrooms as c}
							<option value={c.id}>{c.name} ({c.code})</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="course-subject" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
							{$i18n.t('Subject')}
						</label>
						<input
							id="course-subject"
							type="text"
							bind:value={newCourseSubject}
							placeholder="e.g. Physics"
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="course-level" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
							{$i18n.t('Level')}
						</label>
						<select
							id="course-level"
							bind:value={newCourseLevel}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
						>
							<option value="Beginner">Beginner</option>
							<option value="Intermediate">Intermediate</option>
							<option value="Advanced">Advanced</option>
						</select>
					</div>
				</div>
				<div>
					<label for="course-desc" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Description')}
					</label>
					<textarea
						id="course-desc"
						bind:value={newCourseDesc}
						rows="3"
						placeholder="Course syllabus and key objectives..."
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					></textarea>
				</div>
			</div>
			<div class="flex justify-end gap-3">
				<button
					on:click={() => (showCreateCourseModal = false)}
					class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
				>
					{$i18n.t('Cancel')}
				</button>
				<button
					on:click={handleCreateCourse}
					class="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
				>
					{$i18n.t('Save Course')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: CREATE ASSIGNMENT -->
{#if showCreateAssignmentModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
			<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
				{$i18n.t('Create New Assignment')}
			</h3>
			<div class="space-y-4 mb-6">
				<div>
					<label for="asg-title" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Assignment Title')} *
					</label>
					<input
						id="asg-title"
						type="text"
						bind:value={newAssignmentTitle}
						placeholder="e.g. Newton's Second Law Problem Set"
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="asg-course" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Course')} *
					</label>
					<select
						id="asg-course"
						bind:value={newAssignmentCourseId}
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					>
						{#each courses as c}
							<option value={c.id}>{c.title} ({c.classroom_name})</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="asg-points" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
							{$i18n.t('Max Points')}
						</label>
						<input
							id="asg-points"
							type="number"
							bind:value={newAssignmentPoints}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
						/>
					</div>
					<div>
						<label for="asg-due" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
							{$i18n.t('Due Date')}
						</label>
						<input
							id="asg-due"
							type="text"
							bind:value={newAssignmentDueDate}
							placeholder="e.g. Next Friday, 5 PM"
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
						/>
					</div>
				</div>

				<div class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-between">
					<div>
						<span class="text-sm font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
							<span>✨</span> {$i18n.t('Enable Tutor AI Feedback & Grading')}
						</span>
						<p class="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
							{$i18n.t('Provides the student with instant constructive AI feedback and a suggested score upon submitting.')}
						</p>
					</div>
					<input
						type="checkbox"
						bind:checked={newAssignmentAiGrading}
						class="w-5 h-5 text-purple-600 rounded"
					/>
				</div>

				<div>
					<label for="asg-desc" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Instructions')}
					</label>
					<textarea
						id="asg-desc"
						bind:value={newAssignmentDesc}
						rows="4"
						placeholder="Explain what the student needs to solve and provide..."
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					></textarea>
				</div>
			</div>
			<div class="flex justify-end gap-3">
				<button
					on:click={() => (showCreateAssignmentModal = false)}
					class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
				>
					{$i18n.t('Cancel')}
				</button>
				<button
					on:click={handleCreateAssignment}
					class="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
				>
					{$i18n.t('Publish Assignment')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: REVIEW SUBMISSIONS -->
{#if selectedAssignmentForGrading}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
			<div class="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
				<div>
					<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
						{$i18n.t('Submissions')}: {selectedAssignmentForGrading.title}
					</h3>
					<span class="text-xs text-gray-500">
						{submissionsList.length} {$i18n.t('students submitted')}
					</span>
				</div>
				<button on:click={() => { selectedAssignmentForGrading = null; selectedSubmission = null; }} class="text-gray-400 hover:text-gray-200">
					&times;
				</button>
			</div>

			<div class="flex-1 overflow-y-auto py-4">
				{#if submissionsList.length === 0}
					<p class="text-sm text-gray-500 text-center py-10">
						{$i18n.t('No submissions received yet for this task.')}
					</p>
				{:else}
					<div class="grid gap-3">
						{#each submissionsList as sub (sub.id)}
							<div class="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
								<div>
									<div class="font-bold text-gray-900 dark:text-gray-100">{sub.student_name}</div>
									<div class="text-xs text-gray-500">{sub.student_email}</div>
									<div class="text-xs text-gray-400 mt-1">
										{$i18n.t('Status')}: <strong class="uppercase">{sub.status}</strong>
										{#if sub.grade !== null && sub.grade !== undefined}
											<span class="ml-2 text-emerald-600 font-bold">({sub.grade} pts)</span>
										{/if}
									</div>
								</div>
								<button
									on:click={() => selectSubmissionForGrade(sub)}
									class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
								>
									{$i18n.t('Review & Grade')}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
				<button
					on:click={() => { selectedAssignmentForGrading = null; selectedSubmission = null; }}
					class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm"
				>
					{$i18n.t('Close')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: GRADE SINGLE SUBMISSION -->
{#if selectedSubmission}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
					{$i18n.t('Grade Submission')}: {selectedSubmission.student_name}
				</h3>
				<button on:click={() => (selectedSubmission = null)} class="text-gray-400 hover:text-gray-200">
					&times;
				</button>
			</div>

			<!-- Student's solution -->
			<div class="mb-4">
				<span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">{$i18n.t('Student Work')}:</span>
				<div class="mt-1 p-3.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
					{selectedSubmission.content}
				</div>
			</div>

			<!-- AI Feedback if present -->
			{#if selectedSubmission.ai_feedback}
				<div class="mb-4 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg text-xs">
					<div class="font-bold text-purple-800 dark:text-purple-300 mb-1 flex items-center justify-between">
						<span>✨ {$i18n.t('Tutor AI Suggested Evaluation')}:</span>
						<span>{$i18n.t('Suggested Score')}: {selectedSubmission.ai_grade}</span>
					</div>
					<p class="text-purple-900 dark:text-purple-200">{selectedSubmission.ai_feedback}</p>
				</div>
			{/if}

			<!-- Teacher Grade and Feedback Inputs -->
			<div class="space-y-4 mb-6">
				<div>
					<label for="grade-score" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Score')} (max: {selectedAssignmentForGrading?.points || 100})
					</label>
					<input
						id="grade-score"
						type="number"
						bind:value={gradeInput}
						class="w-32 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="grade-feedback" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
						{$i18n.t('Teacher Feedback for Student')}
					</label>
					<textarea
						id="grade-feedback"
						bind:value={feedbackInput}
						rows="4"
						placeholder="Add your personalized comments and advice..."
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
					></textarea>
				</div>
			</div>

			<div class="flex justify-end gap-3">
				<button
					on:click={() => (selectedSubmission = null)}
					class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
				>
					{$i18n.t('Cancel')}
				</button>
				<button
					on:click={saveGrade}
					disabled={gradingSaving}
					class="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
				>
					{#if gradingSaving}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
					{/if}
					{$i18n.t('Confirm Grade')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: COURSE KNOWLEDGE BASE & DOCUMENTS -->
{#if selectedCourseForKnowledge}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
			<div class="flex justify-between items-start pb-4 border-b border-gray-200 dark:border-gray-700">
				<div>
					<div class="flex items-center gap-2">
						<span class="text-xl">📚</span>
						<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
							{$i18n.t('Course Knowledge Base')}
						</h3>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						{selectedCourseForKnowledge.title} • {$i18n.t('Documents here are used by Tutor AI exclusively for this course.')}
					</p>
				</div>
				<button
					on:click={() => { selectedCourseForKnowledge = null; courseKnowledgeData = null; }}
					class="text-gray-400 hover:text-gray-200 text-2xl font-bold p-1"
				>
					&times;
				</button>
			</div>

			<div class="flex-1 overflow-y-auto py-5 space-y-5">
				<!-- Upload Box -->
				<div class="p-4 border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl text-center">
					<input
						type="file"
						accept=".pdf,.txt,.docx,.md"
						class="hidden"
						bind:this={knowledgeFileInput}
						on:change={handleUploadKnowledgeFile}
						disabled={uploadingKnowledgeFile}
					/>
					<div class="flex flex-col items-center justify-center gap-2">
						<span class="text-3xl">📄</span>
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-200">
							{$i18n.t('Upload Course Documents')}
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
							{$i18n.t('Upload syllabus, study guides, reading materials or exercises (PDF, TXT, MD, DOCX).')}
						</p>
						<button
							on:click={() => knowledgeFileInput?.click()}
							disabled={uploadingKnowledgeFile}
							class="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition"
						>
							{#if uploadingKnowledgeFile}
								<div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								<span>{$i18n.t('Indexing Document with AI...')}</span>
							{:else}
								<span>+</span>
								<span>{$i18n.t('Select File to Index')}</span>
							{/if}
						</button>
					</div>
				</div>

				<!-- Indexed Files List -->
				<div>
					<h4 class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
						{$i18n.t('Indexed Course Materials')}
					</h4>

					{#if loadingKnowledge}
						<div class="flex justify-center py-8">
							<div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
						</div>
					{:else if !courseKnowledgeData || !courseKnowledgeData.files || courseKnowledgeData.files.length === 0}
						<div class="p-6 text-center bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800">
							<p class="text-sm text-gray-500 dark:text-gray-400">
								{$i18n.t('No documents indexed yet for this course.')}
							</p>
							<p class="text-xs text-gray-400 mt-1">
								{$i18n.t('Upload documents above so Tutor AI can reference them during student conversations.')}
							</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each courseKnowledgeData.files as kfile}
								<div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
									<div class="flex items-center gap-3 overflow-hidden">
										<span class="text-lg">📑</span>
										<div class="truncate">
											<div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
												{kfile.meta?.name || kfile.name || kfile.file_id || $i18n.t('Course Document')}
											</div>
											<div class="text-[10px] text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
												<span>✓</span> {$i18n.t('Indexed & active for Tutor AI')}
											</div>
										</div>
									</div>

									<button
										on:click={() => handleRemoveKnowledgeFile(kfile.file_id || kfile.id)}
										class="px-2.5 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition"
									>
										{$i18n.t('Remove')}
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
				<button
					on:click={() => { selectedCourseForKnowledge = null; courseKnowledgeData = null; }}
					class="px-5 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition"
				>
					{$i18n.t('Done')}
				</button>
			</div>
		</div>
	</div>
{/if}


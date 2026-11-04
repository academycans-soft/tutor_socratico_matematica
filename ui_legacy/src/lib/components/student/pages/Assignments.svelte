<!-- Assignments.svelte -->
<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		getAssignments,
		submitAssignment,
		type Assignment
	} from '$lib/apis/assignments';

	const i18n = getContext('i18n');

	let assignments: Assignment[] = [];
	let loading = true;

	// Submit modal state
	let selectedAssignment: Assignment | null = null;
	let submissionContent = '';
	let submitting = false;

	onMount(async () => {
		await loadAssignments();
	});

	async function loadAssignments() {
		loading = true;
		try {
			const token = localStorage.getItem('token') || '';
			assignments = await getAssignments(token);
		} catch (err: any) {
			console.error('Error fetching assignments:', err);
			toast.error($i18n.t('Failed to load assignments'));
		} finally {
			loading = false;
		}
	}

	function openSubmitModal(assignment: Assignment) {
		selectedAssignment = assignment;
		submissionContent = assignment.my_submission?.content || '';
	}

	async function handleSubmit() {
		if (!selectedAssignment) return;
		if (!submissionContent.trim()) {
			toast.error($i18n.t('Please write your response or solution'));
			return;
		}

		submitting = true;
		try {
			const token = localStorage.getItem('token') || '';
			const result = await submitAssignment(token, selectedAssignment.id, submissionContent.trim());
			toast.success($i18n.t('Assignment submitted successfully!'));
			if (selectedAssignment.enable_ai_grading && result.ai_feedback) {
				toast.info($i18n.t('Tutor AI provided instant feedback on your submission!'));
			}
			selectedAssignment = null;
			await loadAssignments();
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Failed to submit assignment'));
		} finally {
			submitting = false;
		}
	}

	function getStatusBadge(assignment: Assignment) {
		const sub = assignment.my_submission;
		if (!sub) {
			return {
				label: $i18n.t('Pending'),
				class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
			};
		}
		if (sub.status === 'graded') {
			return {
				label: `${$i18n.t('Graded')}: ${sub.grade}/${assignment.points}`,
				class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
			};
		}
		return {
			label: $i18n.t('Submitted'),
			class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
		};
	}
</script>

<div class="p-6 max-w-6xl mx-auto">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
			{$i18n.t('Assignments & Tasks')}
		</h1>
		<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
			{$i18n.t('Complete assigned tasks from your courses and receive teacher or AI tutor feedback')}
		</p>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-20">
			<div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
		</div>
	{:else if assignments.length === 0}
		<div class="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-sm">
			<div class="w-16 h-16 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
				<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
				{$i18n.t('All caught up! No assignments pending')}
			</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
				{$i18n.t('When your teachers publish new tasks or projects in your classrooms, they will appear here.')}
			</p>
		</div>
	{:else}
		<div class="grid gap-6">
			{#each assignments as assignment (assignment.id)}
				{@const status = getStatusBadge(assignment)}
				<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
					<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
						<div>
							<div class="flex items-center gap-3 mb-1">
								<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
									{assignment.title}
								</h3>
								<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold {status.class}">
									{status.label}
								</span>
								{#if assignment.enable_ai_grading}
									<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 flex items-center gap-1">
										<span>✨</span> {$i18n.t('AI Grading')}
									</span>
								{/if}
							</div>
							<p class="text-sm text-gray-500 dark:text-gray-400">
								<span><strong>{$i18n.t('Course')}:</strong> {assignment.course_title || 'General'}</span>
								<span class="mx-2">•</span>
								<span><strong>{$i18n.t('Max Points')}:</strong> {assignment.points}</span>
								{#if assignment.due_date}
									<span class="mx-2">•</span>
									<span><strong>{$i18n.t('Due Date')}:</strong> {assignment.due_date}</span>
								{/if}
							</p>
						</div>

						<button
							on:click={() => openSubmitModal(assignment)}
							class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition self-start md:self-auto"
						>
							{assignment.my_submission ? $i18n.t('Update Submission') : $i18n.t('Submit Solution')}
						</button>
					</div>

					<div class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line mb-4">
						{assignment.description || $i18n.t('No detailed instructions provided.')}
					</div>

					{#if assignment.my_submission}
						<div class="border-t border-gray-100 dark:border-gray-700/60 pt-4 mt-2">
							<h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
								{$i18n.t('Your Submission:')}
							</h4>
							<p class="text-sm text-gray-800 dark:text-gray-200 italic mb-3 bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
								"{assignment.my_submission.content}"
							</p>

							{#if assignment.my_submission.ai_feedback}
								<div class="mt-3 p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-lg">
									<div class="flex items-center justify-between mb-1">
										<span class="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
											<span>🤖</span> {$i18n.t('Tutor AI Evaluation')}
										</span>
										{#if assignment.my_submission.ai_grade !== null && assignment.my_submission.ai_grade !== undefined}
											<span class="text-xs font-bold text-purple-900 dark:text-purple-200">
												{$i18n.t('Suggested Score')}: {assignment.my_submission.ai_grade} / {assignment.points}
											</span>
										{/if}
									</div>
									<p class="text-sm text-purple-900 dark:text-purple-200">
										{assignment.my_submission.ai_feedback}
									</p>
								</div>
							{/if}

							{#if assignment.my_submission.feedback}
								<div class="mt-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg">
									<div class="flex items-center justify-between mb-1">
										<span class="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
											<span>👨‍🏫</span> {$i18n.t('Teacher Feedback')}
										</span>
										<span class="text-xs font-bold text-emerald-900 dark:text-emerald-200">
											{$i18n.t('Final Grade')}: {assignment.my_submission.grade} / {assignment.points}
										</span>
									</div>
									<p class="text-sm text-emerald-900 dark:text-emerald-200">
										{assignment.my_submission.feedback}
									</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if selectedAssignment}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
			<div class="flex justify-between items-center mb-4">
				<div>
					<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
						{$i18n.t('Submit Solution')}: {selectedAssignment.title}
					</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{$i18n.t('Course')}: {selectedAssignment.course_title}
					</p>
				</div>
				<button
					on:click={() => (selectedAssignment = null)}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="mb-4">
				<label for="submission-text" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
					{$i18n.t('Your Work / Answer / Code')}
				</label>
				<textarea
					id="submission-text"
					bind:value={submissionContent}
					rows="8"
					placeholder="{$i18n.t('Write your explanation, answer, or code solution here...')}"
					class="w-full p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
				></textarea>
			</div>

			{#if selectedAssignment.enable_ai_grading}
				<div class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-xs text-purple-700 dark:text-purple-300 mb-5 flex items-center gap-2">
					<span>✨</span>
					<span>{$i18n.t('AI Evaluation enabled by your teacher: You will receive instant constructive feedback upon submitting.')}</span>
				</div>
			{/if}

			<div class="flex justify-end gap-3">
				<button
					type="button"
					on:click={() => (selectedAssignment = null)}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
				>
					{$i18n.t('Cancel')}
				</button>
				<button
					type="button"
					on:click={handleSubmit}
					disabled={submitting}
					class="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
				>
					{#if submitting}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
					{/if}
					{$i18n.t('Confirm Submission')}
				</button>
			</div>
		</div>
	</div>
{/if}

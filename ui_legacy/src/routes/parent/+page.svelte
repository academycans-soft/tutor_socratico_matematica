<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { user } from '$lib/stores';
	import {
		getChildren,
		linkStudentByEmail,
		getChildProgress,
		type ChildSummary,
		type ChildProgress
	} from '$lib/apis/parents';

	const i18n = getContext('i18n');

	let children: ChildSummary[] = [];
	let loading = true;
	let showLinkModal = false;
	let studentEmailInput = '';
	let linking = false;

	// Progress view
	let selectedChildId: string | null = null;
	let childProgress: ChildProgress | null = null;
	let loadingProgress = false;

	onMount(async () => {
		if (!$user) {
			goto('/auth');
			return;
		}

		if ($user.role !== 'parent' && !$user.is_admin) {
			toast.error($i18n.t('Parent portal requires parent role'));
			goto('/');
			return;
		}

		await loadChildren();
	});

	async function loadChildren() {
		loading = true;
		try {
			const token = localStorage.getItem('token') || '';
			children = await getChildren(token);
			if (children.length > 0 && !selectedChildId) {
				await selectChild(children[0].student_id);
			}
		} catch (err: any) {
			console.error('Error loading children:', err);
		} finally {
			loading = false;
		}
	}

	async function selectChild(studentId: string) {
		selectedChildId = studentId;
		loadingProgress = true;
		try {
			const token = localStorage.getItem('token') || '';
			childProgress = await getChildProgress(token, studentId);
		} catch (err: any) {
			toast.error($i18n.t('Failed to load child progress details'));
		} finally {
			loadingProgress = false;
		}
	}

	async function handleLink() {
		if (!studentEmailInput.trim()) {
			toast.error($i18n.t('Please enter your child\'s student email'));
			return;
		}

		linking = true;
		try {
			const token = localStorage.getItem('token') || '';
			await linkStudentByEmail(token, studentEmailInput.trim());
			toast.success($i18n.t('Student linked successfully!'));
			studentEmailInput = '';
			showLinkModal = false;
			await loadChildren();
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Failed to link student. Verify the email exists.'));
		} finally {
			linking = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-800 gap-4 mb-6">
			<div>
				<h1 class="text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-3">
					<span>👨‍👩‍👧</span> {$i18n.t('Parent Supervision Portal')}
				</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					{$i18n.t('Monitor your children\'s learning sessions, assignments, and academic performance with Open TutorAI.')}
				</p>
			</div>

			<div class="flex items-center gap-3">
				<button
					on:click={() => (showLinkModal = true)}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
				>
					<span>+</span> {$i18n.t('Link Child')}
				</button>
			</div>
		</div>

		{#if loading}
			<div class="flex justify-center items-center py-20">
				<div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
			</div>
		{:else if children.length === 0}
			<div class="bg-white dark:bg-gray-800 p-12 text-center rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-lg mx-auto">
				<div class="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
					👨‍👧
				</div>
				<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
					{$i18n.t('No children linked yet')}
				</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
					{$i18n.t('Link your student using their registered school email address to begin supervising their homework and tutoring history.')}
				</p>
				<button
					on:click={() => (showLinkModal = true)}
					class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
				>
					{$i18n.t('Link Student Now')}
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
				<!-- Children Selector Sidebar -->
				<div class="md:col-span-1 space-y-3">
					<h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
						{$i18n.t('Linked Students')}
					</h3>
					{#each children as child}
						<button
							on:click={() => selectChild(child.student_id)}
							class="w-full text-left p-4 rounded-xl border transition flex flex-col {selectedChildId === child.student_id ? 'bg-blue-50 border-blue-300 dark:bg-blue-950/40 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50'}"
						>
							<span class="font-bold text-gray-900 dark:text-gray-100 text-sm">{child.name}</span>
							<span class="text-xs text-gray-500 truncate">{child.email}</span>
							<div class="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
								<span><strong>{child.supports_count}</strong> {$i18n.t('sessions')}</span>
								<span>•</span>
								<span><strong>{child.submissions_count}</strong> {$i18n.t('tasks')}</span>
							</div>
						</button>
					{/each}
				</div>

				<!-- Child Progress Report -->
				<div class="md:col-span-3">
					{#if loadingProgress}
						<div class="flex justify-center items-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
							<div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
						</div>
					{:else if childProgress}
						<div class="space-y-6">
							<!-- Student Summary Card -->
							<div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
								<div>
									<h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
										{childProgress.student.name}
									</h2>
									<p class="text-sm text-gray-500">{childProgress.student.email}</p>
								</div>
								<div class="flex gap-4 text-center">
									<div class="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
										<div class="text-xl font-bold text-blue-600 dark:text-blue-400">{childProgress.supports.length}</div>
										<div class="text-[11px] text-gray-500 uppercase">{$i18n.t('Sessions')}</div>
									</div>
									<div class="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
										<div class="text-xl font-bold text-green-600 dark:text-green-400">{childProgress.submissions.length}</div>
										<div class="text-[11px] text-gray-500 uppercase">{$i18n.t('Tasks Done')}</div>
									</div>
								</div>
							</div>

							<!-- Recent Submissions -->
							<div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
									<span>📝</span> {$i18n.t('Recent Task Submissions & Grades')}
								</h3>

								{#if childProgress.submissions.length === 0}
									<p class="text-sm text-gray-500 py-4 text-center">{$i18n.t('No assignments submitted yet.')}</p>
								{:else}
									<div class="divide-y divide-gray-100 dark:divide-gray-700">
										{#each childProgress.submissions as sub}
											<div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
												<div>
													<div class="font-semibold text-gray-900 dark:text-gray-100 text-sm">
														{sub.assignment_title}
													</div>
													<div class="text-xs text-gray-500">
														{$i18n.t('Submitted')}: {new Date(sub.submitted_at).toLocaleDateString()}
													</div>
													{#if sub.feedback}
														<div class="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
															<strong>{$i18n.t('Teacher')}:</strong> {sub.feedback}
														</div>
													{/if}
													{#if sub.ai_feedback}
														<div class="text-xs text-purple-700 dark:text-purple-400 mt-1">
															<strong>{$i18n.t('Tutor AI')}:</strong> {sub.ai_feedback}
														</div>
													{/if}
												</div>

												<div class="text-right">
													{#if sub.grade !== null && sub.grade !== undefined}
														<span class="px-2.5 py-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-bold text-xs rounded">
															{sub.grade} pts
														</span>
													{:else if sub.ai_grade !== null && sub.ai_grade !== undefined}
														<span class="px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-bold text-xs rounded">
															AI: {sub.ai_grade} pts
														</span>
													{:else}
														<span class="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
															{$i18n.t('Pending Grade')}
														</span>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Recent Tutoring Sessions -->
							<div class="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
									<span>🤖</span> {$i18n.t('Recent AI Tutoring Sessions')}
								</h3>

								{#if childProgress.supports.length === 0}
									<p class="text-sm text-gray-500 py-4 text-center">{$i18n.t('No tutoring sessions registered yet.')}</p>
								{:else}
									<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{#each childProgress.supports as sup}
											<div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
												<div class="font-bold text-gray-900 dark:text-gray-100">{sup.title}</div>
												<div class="text-xs text-gray-500 mt-1">
													<span>{sup.subject || 'General'}</span>
													<span class="mx-1">•</span>
													<span>{new Date(sup.created_at).toLocaleDateString()}</span>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- MODAL: LINK CHILD -->
{#if showLinkModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
			<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
				{$i18n.t('Link Student Account')}
			</h3>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				{$i18n.t('Enter the exact email address your child used to sign up for Open TutorAI.')}
			</p>

			<div class="mb-5">
				<label for="child-email" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
					{$i18n.t('Student Email')}
				</label>
				<input
					id="child-email"
					type="email"
					bind:value={studentEmailInput}
					placeholder="student@school.edu"
					class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100"
				/>
			</div>

			<div class="flex justify-end gap-3">
				<button
					on:click={() => (showLinkModal = false)}
					class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
				>
					{$i18n.t('Cancel')}
				</button>
				<button
					on:click={handleLink}
					disabled={linking}
					class="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
				>
					{#if linking}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
					{/if}
					{$i18n.t('Link Student')}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Classrooms.svelte -->
<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getClassrooms, joinClassroom, type Classroom } from '$lib/apis/classrooms';

	const i18n = getContext('i18n');

	let classrooms: Classroom[] = [];
	let loading = true;
	let showJoinModal = false;
	let joinCode = '';
	let joining = false;

	onMount(async () => {
		await loadClassrooms();
	});

	async function loadClassrooms() {
		loading = true;
		try {
			const token = localStorage.getItem('token') || '';
			classrooms = await getClassrooms(token);
		} catch (err: any) {
			console.error('Error loading classrooms:', err);
			toast.error($i18n.t('Failed to load classrooms'));
		} finally {
			loading = false;
		}
	}

	async function handleJoin() {
		if (!joinCode.trim()) {
			toast.error($i18n.t('Please enter a classroom code'));
			return;
		}

		joining = true;
		try {
			const token = localStorage.getItem('token') || '';
			const joined = await joinClassroom(token, joinCode.trim().toUpperCase());
			toast.success($i18n.t('Successfully joined classroom: ') + joined.name);
			joinCode = '';
			showJoinModal = false;
			await loadClassrooms();
		} catch (err: any) {
			toast.error(err.detail || $i18n.t('Invalid classroom code'));
		} finally {
			joining = false;
		}
	}
</script>

<div class="p-6 max-w-6xl mx-auto">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
				{$i18n.t('My Classrooms')}
			</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				{$i18n.t('Access your learning groups and assigned course material')}
			</p>
		</div>
		<button
			on:click={() => (showJoinModal = true)}
			class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			{$i18n.t('Join with Code')}
		</button>
	</div>

	{#if loading}
		<div class="flex justify-center items-center py-20">
			<div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
		</div>
	{:else if classrooms.length === 0}
		<div class="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-sm mt-4">
			<div class="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
				<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
				</svg>
			</div>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
				{$i18n.t('No classrooms joined yet')}
			</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
				{$i18n.t('Ask your teacher for a classroom code to join and unlock your personalized tutoring courses and assignments.')}
			</p>
			<button
				on:click={() => (showJoinModal = true)}
				class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition"
			>
				{$i18n.t('Enter Classroom Code')}
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each classrooms as classroom (classroom.id)}
				<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between">
					<div>
						<div class="flex items-center justify-between mb-3">
							<span class="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-xs font-semibold rounded-md border border-blue-200 dark:border-blue-800">
								{classroom.code}
							</span>
							<span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
								</svg>
								{classroom.member_count || 1}
							</span>
						</div>
						<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
							{classroom.name}
						</h3>
						<p class="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
							{classroom.description || $i18n.t('No description provided.')}
						</p>
					</div>

					<div class="pt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
						<span>
							{$i18n.t('Teacher')}: <strong class="text-gray-700 dark:text-gray-200">{classroom.teacher_name || $i18n.t('Assigned Teacher')}</strong>
						</span>
						<a
							href="/student/support/create?classroom_id={classroom.id}"
							class="text-blue-600 dark:text-blue-400 font-medium hover:underline"
						>
							{$i18n.t('Start Session')} &rarr;
						</a>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showJoinModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
					{$i18n.t('Join a Classroom')}
				</h3>
				<button
					on:click={() => (showJoinModal = false)}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				{$i18n.t('Enter the 6-character code provided by your teacher (e.g. MAT48X).')}
			</p>

			<div class="mb-5">
				<label for="classroom-code" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
					{$i18n.t('Classroom Code')}
				</label>
				<input
					id="classroom-code"
					type="text"
					bind:value={joinCode}
					placeholder="ABC123"
					maxlength="10"
					class="w-full text-center uppercase tracking-widest text-2xl font-mono px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					on:keydown={(e) => e.key === 'Enter' && handleJoin()}
				/>
			</div>

			<div class="flex justify-end gap-3">
				<button
					type="button"
					on:click={() => (showJoinModal = false)}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
				>
					{$i18n.t('Cancel')}
				</button>
				<button
					type="button"
					on:click={handleJoin}
					disabled={joining}
					class="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2"
				>
					{#if joining}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
					{/if}
					{$i18n.t('Join Classroom')}
				</button>
			</div>
		</div>
	</div>
{/if}

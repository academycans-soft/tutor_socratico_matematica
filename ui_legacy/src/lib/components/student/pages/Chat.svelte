<!-- chat/+page.svelte -->
<script lang="ts">
	import Chat from '$lib/components/student/tutor/Chat.svelte';
	import { page } from '$app/stores';
	import { isFullscreenAvatar } from '$lib/stores';

	let chatData = {};

	function handleChatEvent(event) {
		chatData = { ...chatData, ...event.detail };
	}
</script>

<div
	class="chat-layout flex h-full overflow-hidden relative bg-white dark:bg-gray-900 w-full"
>
	<!-- Main Chat component takes full space -->
	<div
		class="chat-container flex-1 h-full w-full overflow-hidden bg-[#F5F7F9] dark:bg-gray-900"
	>
		<Chat chatIdProp={$page.params.id} on:chatEvent={handleChatEvent} />
	</div>
</div>

<style>
	.chat-layout {
		height: 100%;
		width: 100%;
	}

	.chat-container {
		height: 100%;
		width: 100%;
	}
</style>


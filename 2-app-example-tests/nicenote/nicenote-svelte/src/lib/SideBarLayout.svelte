<script lang="ts">
	import SideBarContents from './SideBarContents.svelte';
</script>

<!-- <div class="h-full w-2/5 bg-amber-900">
	<SideBarContents />
</div> -->
<div class="flex h-full px-2 py-2">
	<div class="mr-2 h-full w-2/6 min-w-56 max-w-80">
		<SideBarContents />
	</div>
	<div>
		<slot></slot>
	</div>
</div>

<p>Hello</p>

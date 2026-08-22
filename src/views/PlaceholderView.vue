<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div
    class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-600 dark:bg-dark-2"
  >
    <h2 class="mb-2 text-2xl font-semibold text-neutral-900 dark:text-white">{{ title }}</h2>
    <p class="mb-0 text-neutral-500 dark:text-neutral-400">
      Coming soon — this page will be ported from BillsSite admin.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'

const auth = useAuthStore()
const router = useRouter()
const { isDark, toggle, init } = useTheme()
init()

const displayName = computed(() => {
  if (!auth.user) return 'User'
  const parts = [auth.user.fname, auth.user.lname].filter(Boolean)
  return parts.length ? parts.join(' ') : auth.user.username
})

function toggleSidebar() {
  window.dispatchEvent(new CustomEvent('mybudget:toggle-sidebar'))
}

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="navbar-header border-b border-neutral-200 dark:border-neutral-600">
    <div class="flex items-center justify-between gap-2 sm:gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <button
          type="button"
          class="twin-collapse hidden items-center justify-center text-neutral-700 transition-colors hover:text-primary-600 xl:flex dark:text-neutral-300"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
        >
          <iconify-icon icon="ph:arrow-arc-left" class="text-2xl"></iconify-icon>
        </button>
        <div class="min-w-0">
          <p class="mb-0 truncate text-xs text-neutral-500 dark:text-neutral-400 sm:text-sm">
            Bills Admin
          </p>
          <h1 class="truncate text-base font-semibold text-neutral-900 dark:text-white sm:text-lg">
            MyBudget
          </h1>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-primary-600 hover:text-primary-600 sm:h-11 sm:w-11 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
          aria-label="Toggle theme"
          @click="toggle"
        >
          <iconify-icon
            :icon="isDark ? 'ph:sun' : 'ph:moon'"
            class="text-xl"
          ></iconify-icon>
        </button>

        <div
          class="relative flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 ps-1 pe-2 sm:py-1.5 sm:pe-3 dark:border-neutral-600 dark:bg-neutral-700"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white"
          >
            {{ displayName.charAt(0).toUpperCase() }}
          </div>
          <span class="hidden max-w-[8rem] truncate text-sm font-medium text-neutral-800 dark:text-white md:inline">
            {{ displayName }}
          </span>
        </div>

        <button
          type="button"
          class="rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:border-primary-600 hover:text-primary-600 sm:px-3 sm:py-2 sm:text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
          @click="onLogout"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
</template>

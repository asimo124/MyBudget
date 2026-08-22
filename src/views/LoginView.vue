<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const showPassword = ref(false)

async function onSubmit() {
  const ok = await auth.login(username.value.trim(), password.value)
  if (ok) {
    router.push({ name: 'bills-admin' })
  }
}
</script>

<template>
  <section class="flex min-h-screen flex-wrap bg-white dark:bg-dark-2">
    <div class="hidden lg:block lg:w-1/2">
      <div class="flex h-full flex-col items-center justify-center bg-primary-50 dark:bg-dark-1">
        <img src="/images/logo.png" alt="MyBudget" class="mb-6 max-w-[220px]" />
        <p class="max-w-sm text-center text-lg text-neutral-600 dark:text-neutral-300">
          Budget admin powered by your BillsSite API
        </p>
      </div>
    </div>
    <div class="flex w-full flex-col justify-center px-6 py-8 lg:w-1/2">
      <div class="mx-auto w-full max-w-[464px]">
        <div class="mb-8">
          <img src="/images/logo.png" alt="MyBudget" class="mb-4 max-w-[180px] dark:hidden" />
          <img
            src="/images/logo-light.png"
            alt="MyBudget"
            class="mb-4 hidden max-w-[180px] dark:block"
          />
          <h2 class="mb-2 text-2xl font-semibold text-neutral-900 dark:text-white">
            Sign in to MyBudget
          </h2>
          <p class="text-neutral-500 dark:text-neutral-400">
            Use your BillsSite username and password
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="mb-1.5 block text-sm font-medium" for="username">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              required
              class="form-control h-14 rounded-xl px-4"
              placeholder="Username"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium" for="password">Password</label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                class="form-control h-14 rounded-xl px-4 pe-12"
                placeholder="Password"
              />
              <button
                type="button"
                class="absolute end-4 top-1/2 -translate-y-1/2 text-neutral-500"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>

          <p v-if="auth.error" class="text-sm text-danger-600">{{ auth.error }}</p>

          <button
            type="submit"
            class="btn btn-primary mt-4 h-14 w-full rounded-xl text-sm"
            :disabled="auth.loading"
          >
            {{ auth.loading ? 'Signing in…' : 'Sign In' }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>

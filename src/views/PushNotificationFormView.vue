<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'
import { dateOnly, nowDatetimeLocal, toDatetimeLocalValue } from '@/utils/pushNotificationSchedule'

const props = defineProps({
  mode: {
    type: String,
    default: 'create',
  },
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const schedules = ref([])

const form = reactive({
  task_name: '',
  task_description: '',
  schedule_id: '',
  frequency_days: '',
  last_confirmed: '',
  created_at: nowDatetimeLocal(),
})

const isEdit = computed(() => props.mode === 'edit')
const pageTitle = computed(() => (isEdit.value ? 'Edit Reminder' : 'Create Reminder'))

async function loadSchedulesOnly() {
  const { data } = await api.get('/api/push_notifications/list.php')
  schedules.value = data.schedules || []
}

async function loadReminder() {
  const { data } = await api.get('/api/push_notifications/get.php', {
    params: { id: route.params.id },
  })
  const reminder = data.reminder
  schedules.value = data.schedules || []
  form.task_name = reminder.task_name || ''
  form.task_description = reminder.task_description || ''
  form.schedule_id = reminder.schedule_id ?? ''
  form.frequency_days = reminder.frequency_days || ''
  form.last_confirmed = dateOnly(reminder.last_confirmed)
  form.created_at = toDatetimeLocalValue(reminder.created_at)
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      task_name: form.task_name,
      task_description: form.task_description,
      schedule_id: form.schedule_id === '' ? null : Number(form.schedule_id),
      frequency_days: Number(form.frequency_days),
      last_confirmed: form.last_confirmed || '',
      created_at: form.created_at || '',
    }

    if (isEdit.value) {
      const { data } = await api.post('/api/push_notifications/update.php', {
        ...payload,
        id: Number(route.params.id),
      })
      await router.push({
        name: 'push-notifications',
        query: { Message: data.message || 'Reminder has been updated.' },
      })
    } else {
      const { data } = await api.post('/api/push_notifications/create.php', payload)
      await router.push({
        name: 'push-notifications',
        query: { Message: data.message || 'Reminder has been created.' },
      })
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save reminder.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    if (isEdit.value) {
      await loadReminder()
    } else {
      await loadSchedulesOnly()
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load form.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ pageTitle }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Push notification reminder.</p>
      </div>
      <button
        type="button"
        class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        @click="router.push({ name: 'push-notifications' })"
      >
        Back
      </button>
    </div>

    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ error }}
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>

    <form v-else class="card max-w-xl space-y-4 p-6" @submit.prevent="save">
      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="task_name">Task Name</label>
        <input
          id="task_name"
          v-model="form.task_name"
          type="text"
          maxlength="120"
          required
          class="form-input w-full"
          placeholder="Task Name"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="task_description">
          Task Description
        </label>
        <textarea
          id="task_description"
          v-model="form.task_description"
          rows="4"
          class="form-input w-full"
          placeholder="Task Description"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="schedule_id">Schedule</label>
        <select id="schedule_id" v-model="form.schedule_id" class="form-input w-full">
          <option value="">— None —</option>
          <option v-for="s in schedules" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="frequency_days">
          Frequency (days)
        </label>
        <input
          id="frequency_days"
          v-model="form.frequency_days"
          type="number"
          min="1"
          required
          class="form-input w-full"
          placeholder="Frequency in days"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="last_confirmed">
          Last Confirmed
        </label>
        <input id="last_confirmed" v-model="form.last_confirmed" type="date" class="form-input w-full" />
        <p class="mt-1 text-xs text-gray-500">Leave blank if this task has never been confirmed.</p>
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="created_at">Created At</label>
        <input
          id="created_at"
          v-model="form.created_at"
          type="datetime-local"
          step="1"
          class="form-input w-full"
        />
        <p class="mt-1 text-xs text-gray-500">
          {{
            isEdit
              ? 'Clear to set created_at to NULL.'
              : 'Defaults to now. Clear to let the database set it automatically.'
          }}
        </p>
      </div>

      <div class="flex gap-2 pt-2">
        <button
          type="submit"
          class="btn bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
          :disabled="saving"
        >
          {{ isEdit ? 'Update' : 'Create Reminder' }}
        </button>
        <button
          type="button"
          class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          @click="router.push({ name: 'push-notifications' })"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>

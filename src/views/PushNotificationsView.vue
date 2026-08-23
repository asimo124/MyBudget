<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'

const route = useRoute()
const router = useRouter()

const activeTab = ref(route.query.tab === 'schedules' ? 'schedules' : 'notifications')
const loading = ref(false)
const mainMsg = ref('')
const mainError = ref('')
const reminders = ref([])
const schedules = ref([])

const showDeleteReminder = ref(false)
const showDeleteSchedule = ref(false)
const deleteReminderId = ref(null)
const deleteScheduleId = ref(null)
const deleting = ref(false)

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = tab === 'schedules' ? 'schedules' : 'notifications'
  }
)

watch(
  () => [route.query.Message, route.query.error],
  ([msg, errFlag]) => {
    if (!msg) return
    if (errFlag) {
      mainError.value = String(msg)
      mainMsg.value = ''
    } else {
      mainMsg.value = String(msg)
      mainError.value = ''
    }
  },
  { immediate: true }
)

function setTab(tab) {
  activeTab.value = tab
  router.replace({
    name: 'push-notifications',
    query: {
      ...(tab === 'schedules' ? { tab: 'schedules' } : {}),
      ...(mainMsg.value && !mainError.value ? { Message: mainMsg.value } : {}),
    },
  })
}

async function loadData() {
  loading.value = true
  mainError.value = mainError.value && route.query.error ? mainError.value : ''
  try {
    const { data } = await api.get('/api/push_notifications/list.php')
    reminders.value = data.reminders || []
    schedules.value = data.schedules || []
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to load push notifications.'
  } finally {
    loading.value = false
  }
}

async function onAssignSchedule(reminder, event) {
  const scheduleId = event.target.value
  mainMsg.value = ''
  mainError.value = ''
  try {
    const { data } = await api.post('/api/push_notifications/assign_schedule.php', {
      id: reminder.id,
      schedule_id: scheduleId === '' ? null : Number(scheduleId),
    })
    mainMsg.value = data.message || 'Schedule has been updated.'
    await loadData()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to update schedule.'
    await loadData()
  }
}

function openDeleteReminder(id) {
  deleteReminderId.value = id
  showDeleteReminder.value = true
}

function openDeleteSchedule(id) {
  deleteScheduleId.value = id
  showDeleteSchedule.value = true
}

async function confirmDeleteReminder() {
  if (!deleteReminderId.value) return
  deleting.value = true
  mainError.value = ''
  try {
    const { data } = await api.post('/api/push_notifications/delete.php', {
      id: deleteReminderId.value,
    })
    showDeleteReminder.value = false
    deleteReminderId.value = null
    mainMsg.value = data.message || 'You have deleted a reminder.'
    await loadData()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to delete reminder.'
  } finally {
    deleting.value = false
  }
}

async function confirmDeleteSchedule() {
  if (!deleteScheduleId.value) return
  deleting.value = true
  mainError.value = ''
  try {
    const { data } = await api.post('/api/push_notifications/schedule_delete.php', {
      id: deleteScheduleId.value,
    })
    showDeleteSchedule.value = false
    deleteScheduleId.value = null
    mainMsg.value = data.message || 'You have deleted a schedule.'
    activeTab.value = 'schedules'
    await loadData()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to delete schedule.'
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Push Notifications</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Manage reminder tasks and cron schedules.
      </p>
    </div>

    <div
      v-if="mainMsg"
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
    >
      {{ mainMsg }}
    </div>
    <div
      v-if="mainError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ mainError }}
    </div>

    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex gap-4">
        <button
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium"
          :class="
            activeTab === 'notifications'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          "
          @click="setTab('notifications')"
        >
          Push Notifications
        </button>
        <button
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium"
          :class="
            activeTab === 'schedules'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          "
          @click="setTab('schedules')"
        >
          Schedules
        </button>
      </nav>
    </div>

    <!-- Notifications tab -->
    <div v-show="activeTab === 'notifications'" class="space-y-4">
      <button
        type="button"
        class="btn bg-primary-500 text-white hover:bg-primary-600"
        @click="router.push({ name: 'push-notifications-create' })"
      >
        Create Reminder
      </button>

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Task Name</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Frequency</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Schedule</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Last Confirmed</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Created At</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!loading && !reminders.length">
                <td colspan="7" class="px-3 py-6 text-center text-sm text-gray-500">No reminders yet.</td>
              </tr>
              <tr v-for="reminder in reminders" :key="reminder.id">
                <td class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                  {{ reminder.task_name }}
                </td>
                <td class="max-w-xs truncate px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                  {{ reminder.task_description || '—' }}
                </td>
                <td class="px-3 py-2 text-sm">{{ reminder.frequency_days }}</td>
                <td class="px-3 py-2 text-sm">
                  <select
                    class="form-input min-w-[9rem]"
                    :value="reminder.schedule_id ?? ''"
                    @change="onAssignSchedule(reminder, $event)"
                  >
                    <option value="">— None —</option>
                    <option v-for="s in schedules" :key="s.id" :value="s.id">{{ s.title }}</option>
                  </select>
                </td>
                <td class="whitespace-nowrap px-3 py-2 text-sm">{{ reminder.last_confirmed || '—' }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-sm">{{ reminder.created_at || '—' }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-sm">
                  <button
                    type="button"
                    class="btn mr-1 bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    @click="router.push({ name: 'push-notifications-edit', params: { id: reminder.id } })"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                    @click="openDeleteReminder(reminder.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Schedules tab -->
    <div v-show="activeTab === 'schedules'" class="space-y-4">
      <button
        type="button"
        class="btn bg-primary-500 text-white hover:bg-primary-600"
        @click="router.push({ name: 'push-schedules-create' })"
      >
        Create Schedule
      </button>

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Cron Schedule</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!loading && !schedules.length">
                <td colspan="3" class="px-3 py-6 text-center text-sm text-gray-500">No schedules yet.</td>
              </tr>
              <tr v-for="schedule in schedules" :key="schedule.id">
                <td class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                  {{ schedule.title }}
                </td>
                <td class="px-3 py-2 text-sm">
                  <pre class="m-0 whitespace-pre-wrap font-mono text-xs">{{ schedule.cron_schedule }}</pre>
                </td>
                <td class="whitespace-nowrap px-3 py-2 text-sm">
                  <button
                    type="button"
                    class="btn mr-1 bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    @click="router.push({ name: 'push-schedules-edit', params: { id: schedule.id } })"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                    @click="openDeleteSchedule(schedule.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Delete reminder modal -->
    <div
      v-if="showDeleteReminder"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showDeleteReminder = false"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Delete Reminder</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Are you sure you wish to delete this reminder?
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            @click="showDeleteReminder = false"
          >
            Close
          </button>
          <button
            type="button"
            class="btn bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            :disabled="deleting"
            @click="confirmDeleteReminder"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Delete schedule modal -->
    <div
      v-if="showDeleteSchedule"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showDeleteSchedule = false"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Delete Schedule</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Are you sure you wish to delete this schedule?
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            @click="showDeleteSchedule = false"
          >
            Close
          </button>
          <button
            type="button"
            class="btn bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            :disabled="deleting"
            @click="confirmDeleteSchedule"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div class="rounded-lg bg-white px-6 py-4 shadow-lg dark:bg-gray-800">Loading…</div>
    </div>
  </div>
</template>

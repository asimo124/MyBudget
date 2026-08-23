<script setup>
import { computed, ref } from 'vue'
import api from '@/api/client'

const origin = ref('33 lynn batts ln 78218')
const destination = ref('')
const timeMode = ref('departure')
const loading = ref(false)
const error = ref('')
const result = ref(null)

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const localDateTime = ref(toLocalInputValue(new Date()))

const canSubmit = computed(
  () => origin.value.trim() && destination.value.trim() && localDateTime.value
)

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.round((totalSeconds % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  return `${m} min`
}

function formatWhen(date) {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function parseSeconds(durationStr) {
  if (!durationStr) return 0
  const match = String(durationStr).match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

async function estimate() {
  error.value = ''
  result.value = null
  loading.value = true
  try {
    const anchor = new Date(localDateTime.value)
    const { data } = await api.post('/api/request_google_maps_trip_duration.php', {
      origin: origin.value.trim(),
      destination: destination.value.trim(),
      timeMode: timeMode.value,
      timestamp: anchor.toISOString(),
    })

    if (!data?.minDuration || !data?.maxDuration) {
      throw new Error('No route found between those addresses.')
    }

    const minSeconds = parseSeconds(data.minDuration)
    const maxSeconds = parseSeconds(data.maxDuration)
    const meters = data.distanceMeters || 0
    const miles = (meters / 1609.34).toFixed(1)

    const durationLabel =
      minSeconds === maxSeconds
        ? formatDuration(minSeconds)
        : `${formatDuration(minSeconds)} – ${formatDuration(maxSeconds)}`

    let whenLabel
    if (timeMode.value === 'departure') {
      const earliestArrival = new Date(anchor.getTime() + minSeconds * 1000)
      const latestArrival = new Date(anchor.getTime() + maxSeconds * 1000)
      whenLabel =
        minSeconds === maxSeconds
          ? `arriving ${formatWhen(earliestArrival)}`
          : `arriving ${formatWhen(earliestArrival)} – ${formatWhen(latestArrival)}`
    } else {
      const latestLeave = new Date(anchor.getTime() - minSeconds * 1000)
      const earliestLeave = new Date(anchor.getTime() - maxSeconds * 1000)
      whenLabel =
        minSeconds === maxSeconds
          ? `leave by ${formatWhen(latestLeave)}`
          : `leave ${formatWhen(earliestLeave)} – ${formatWhen(latestLeave)}`
    }

    result.value = {
      durationLabel,
      distanceLabel: `${miles} mi`,
      whenLabel,
    }
  } catch (err) {
    const msg =
      err.response?.data?.error?.message ||
      err.response?.data?.error ||
      err.message ||
      'Something went wrong.'
    error.value = typeof msg === 'string' ? msg : 'Something went wrong.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md space-y-6">
    <div>
      <p class="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Route Planner</p>
      <h1 class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">How long will it take?</h1>
    </div>

    <div class="card">
      <div class="card-body space-y-4">
        <div class="route-sig flex items-center gap-2.5 py-1" :class="{ 'route-sig--animate': result }">
          <div class="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-400"></div>
          <div class="route-sig__line relative h-0 flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600">
            <div class="route-sig__fill absolute -top-0.5 left-0 h-0.5 w-0 border-t-2 border-dashed border-amber-500"></div>
          </div>
          <div class="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"></div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">From</label>
          <div class="relative">
            <input v-model="origin" type="text" placeholder="Starting address" class="form-input w-full pr-10" />
            <button
              v-if="origin"
              type="button"
              class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              aria-label="Clear origin"
              @click="origin = ''"
            >
              ×
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">To</label>
          <div class="relative">
            <input v-model="destination" type="text" placeholder="Destination address" class="form-input w-full pr-10" />
            <button
              v-if="destination"
              type="button"
              class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              aria-label="Clear destination"
              @click="destination = ''"
            >
              ×
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors"
            :class="
              timeMode === 'departure'
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
            "
            @click="timeMode = 'departure'"
          >
            Leave at
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors"
            :class="
              timeMode === 'arrival'
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
            "
            @click="timeMode = 'arrival'"
          >
            Arrive by
          </button>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
            {{ timeMode === 'departure' ? 'Departure time' : 'Arrival time' }}
          </label>
          <input v-model="localDateTime" type="datetime-local" class="form-input w-full" />
        </div>

        <button
          type="button"
          class="btn w-full bg-amber-500 py-3 font-bold text-amber-950 hover:bg-amber-600 disabled:opacity-50"
          :disabled="loading || !canSubmit"
          @click="estimate"
        >
          {{ loading ? 'Calculating…' : 'Estimate trip time' }}
        </button>

        <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      </div>
    </div>

    <div v-if="result" class="card">
      <div class="card-body py-6 text-center">
        <div class="font-mono text-4xl font-bold text-amber-500">{{ result.durationLabel }}</div>
        <div class="mt-2 font-mono text-sm text-gray-500 dark:text-gray-400">{{ result.whenLabel }}</div>
        <div class="mt-3 text-sm text-gray-500 dark:text-gray-400">{{ result.distanceLabel }}</div>
      </div>
    </div>

    <p class="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
      Uses Google's Routes API via your server-side key. Set
      <code class="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800">GOOGLE_MAPS_API_KEY</code>
      in the BillsSite <code class="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800">.env</code> file.
    </p>
  </div>
</template>

<style scoped>
.route-sig--animate .route-sig__fill {
  animation: route-fill 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  width: 100%;
}

@keyframes route-fill {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}
</style>

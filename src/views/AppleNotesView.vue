<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import api from '@/api/client'

const FILTER_STORAGE_KEY = 'apple_notes_filters'

function getDefaultFilters() {
  return {
    keyword_title: '',
    keyword_body: '',
    start_date: '',
    end_date: '',
    sort_by: 'modification_date',
    sort_dir: 'DESC',
    deleted: false,
  }
}

function loadStoredFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

const stored = loadStoredFilters()
const defaults = getDefaultFilters()

const notes = ref([])
const selectedIds = ref([])
const viewingNote = ref(null)
const copyStatus = ref('')
let copyStatusTimer = null

const filters = reactive({
  keyword_title:
    stored && typeof stored.keyword_title === 'string'
      ? stored.keyword_title
      : stored && typeof stored.keyword === 'string'
        ? stored.keyword
        : defaults.keyword_title,
  keyword_body:
    stored && typeof stored.keyword_body === 'string' ? stored.keyword_body : defaults.keyword_body,
  start_date: stored && typeof stored.start_date === 'string' ? stored.start_date : defaults.start_date,
  end_date: stored && typeof stored.end_date === 'string' ? stored.end_date : defaults.end_date,
  sort_by:
    stored && ['modification_date', 'creation_date', 'name', 'folder'].includes(stored.sort_by)
      ? stored.sort_by
      : defaults.sort_by,
  sort_dir:
    stored && (stored.sort_dir === 'ASC' || stored.sort_dir === 'DESC')
      ? stored.sort_dir
      : defaults.sort_dir,
  deleted: stored && typeof stored.deleted === 'boolean' ? stored.deleted : defaults.deleted,
})

const page = ref(1)
const perPage = ref(20)
const total = ref(0)
const totalPages = ref(1)
const loading = ref(false)
const deleting = ref(false)
const uploading = ref(false)
const exporting = ref(false)
const error = ref('')
const message = ref('')
const uploadFile = ref(null)

const allSelected = computed(
  () => notes.value.length > 0 && notes.value.every((n) => selectedIds.value.includes(n.id))
)
const someSelected = computed(() => selectedIds.value.length > 0 && !allSelected.value)

const pageNumbers = computed(() => {
  const totalP = totalPages.value
  const current = page.value
  if (totalP <= 1) return [1]
  if (totalP <= 9) return Array.from({ length: totalP }, (_, i) => i + 1)

  const pages = new Set([1, totalP, current, current - 1, current + 1, current - 2, current + 2])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalP).sort((a, b) => a - b)
  const result = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...')
    result.push(sorted[i])
  }
  return result
})

watch(
  filters,
  (value) => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* ignore */
    }
  },
  { deep: true }
)

function persistFilters() {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    /* ignore */
  }
}

async function loadNotes() {
  loading.value = true
  error.value = ''
  try {
    const params = {
      page: page.value,
      per_page: perPage.value,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
    }
    if (filters.keyword_title) params.keyword_title = filters.keyword_title
    if (filters.keyword_body) params.keyword_body = filters.keyword_body
    if (filters.start_date) params.start_date = filters.start_date
    if (filters.end_date) params.end_date = filters.end_date
    if (filters.deleted) params.deleted = '1'

    const { data } = await api.get('/api/loadAppleNotes.php', { params })
    if (data?.error) {
      error.value = data.error
      notes.value = []
      total.value = 0
      totalPages.value = 1
      return
    }

    notes.value = (data.items || []).map((n) => ({
      ...n,
      id: parseInt(n.id, 10),
    }))
    total.value = data.total || 0
    page.value = data.page || 1
    perPage.value = data.per_page || perPage.value
    totalPages.value = data.total_pages || 1
    selectedIds.value = []
    viewingNote.value = null
  } catch (err) {
    error.value = err.response?.data?.message || err.response?.data?.error || 'Failed to load notes.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  message.value = ''
  persistFilters()
  loadNotes()
}

function clearKeyword(field) {
  if (field !== 'keyword_title' && field !== 'keyword_body') return
  filters[field] = ''
  applyFilters()
}

function clearDate(field) {
  if (field !== 'start_date' && field !== 'end_date') return
  filters[field] = ''
  applyFilters()
}

function clearFilters() {
  Object.assign(filters, getDefaultFilters())
  page.value = 1
  message.value = ''
  persistFilters()
  loadNotes()
}

function changePerPage() {
  page.value = 1
  loadNotes()
}

function goToPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  loadNotes()
}

function toggleSelectAll(event) {
  if (event.target.checked) {
    selectedIds.value = notes.value.map((n) => n.id)
  } else {
    selectedIds.value = []
  }
}

function openNoteModal(note) {
  viewingNote.value = note
  copyStatus.value = ''
}

function closeNoteModal() {
  viewingNote.value = null
  copyStatus.value = ''
}

function normalizeNoteBody(text) {
  if (!text) return ''
  let normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, '\n')

  // Apple Notes export often stores line breaks as 2+ spaces.
  normalized = normalized.replace(/ {2,}/g, '\n')

  // Some exports collapse line breaks to a single space before labeled lines.
  normalized = normalized.replace(/(?<=\d)\s+(?=[A-Z][a-zA-Z %]*:)/g, '\n')
  normalized = normalized.replace(/(?<=[.!?])\s+(?=[A-Z][a-zA-Z %]*:)/g, '\n')

  normalized = normalized.replace(/\n{3,}/g, '\n\n').trim()
  const lines = normalized.split('\n')
  if (lines.length <= 1) return normalized
  return lines[0] + '\n\n' + lines.slice(1).map((line) => '- ' + line).join('\n')
}

async function copyNoteBody() {
  const text = normalizeNoteBody(viewingNote.value?.body || '')
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    copyStatus.value = 'Copied'
    clearTimeout(copyStatusTimer)
    copyStatusTimer = setTimeout(() => {
      copyStatus.value = ''
    }, 1500)
  } catch {
    copyStatus.value = 'Failed'
    clearTimeout(copyStatusTimer)
    copyStatusTimer = setTimeout(() => {
      copyStatus.value = ''
    }, 1500)
  }
}

function formatDate(value) {
  if (!value) return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return String(value)
  return `${match[2]}/${match[3]}/${match[1]}`
}

async function deleteSelected() {
  if (!selectedIds.value.length) return
  deleting.value = true
  error.value = ''
  message.value = ''
  try {
    const { data } = await api.post('/api/deleteAppleNotes.php', {
      ids: selectedIds.value,
    })
    if (data?.success) {
      message.value =
        data.message ||
        `Marked ${data.deleted_count || selectedIds.value.length} note(s) for deletion.`
      await loadNotes()
    } else {
      error.value = data?.error || data?.message || 'Delete failed.'
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.response?.data?.error || 'Failed to delete notes.'
  } finally {
    deleting.value = false
  }
}

function onUploadFileChange(event) {
  uploadFile.value = event.target.files?.[0] || null
}

async function submitUpload() {
  if (!uploadFile.value) {
    error.value = 'Please select a CSV file.'
    return
  }
  uploading.value = true
  error.value = ''
  message.value = ''
  try {
    const formData = new FormData()
    formData.append('apple_notes_file', uploadFile.value)
    const { data } = await api.post('/api/apple_notes/upload.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    message.value = data.message || 'Apple Notes imported successfully.'
    uploadFile.value = null
    const input = document.getElementById('apple_notes_file')
    if (input) input.value = ''
    page.value = 1
    await loadNotes()
  } catch (err) {
    error.value = err.response?.data?.message || 'Upload failed.'
  } finally {
    uploading.value = false
  }
}

async function exportCsv() {
  exporting.value = true
  error.value = ''
  try {
    const { data } = await api.post(
      '/api/apple_notes/export.php',
      {},
      { responseType: 'blob' }
    )
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `apple_notes_to_delete_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.value = 'CSV downloaded.'
  } catch (err) {
    error.value = err.response?.data?.message || 'Export failed.'
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadNotes()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Apple Notes Manager</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Upload, search, and mark Apple Notes for deletion.
      </p>
    </div>

    <div
      v-if="message"
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
    >
      {{ message }}
    </div>
    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Upload -->
    <div class="card">
      <div class="card-body space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Upload</h2>
        <div>
          <label for="apple_notes_file" class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            Upload Apple Notes
          </label>
          <input
            id="apple_notes_file"
            type="file"
            accept=".csv"
            class="form-input w-full max-w-md"
            @change="onUploadFileChange"
          />
        </div>
        <button
          type="button"
          class="btn bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
          :disabled="uploading"
          @click="submitUpload"
        >
          {{ uploading ? 'Uploading…' : 'Upload File' }}
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div>
      <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Notes</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Title keyword</label>
          <div class="relative">
            <input
              v-model="filters.keyword_title"
              type="text"
              placeholder="Search title..."
              class="form-input w-full pr-9"
              @keyup.enter="applyFilters"
            />
            <button
              v-if="filters.keyword_title"
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
              aria-label="Clear title keyword"
              @click="clearKeyword('keyword_title')"
            >
              ×
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Body keyword</label>
          <div class="relative">
            <input
              v-model="filters.keyword_body"
              type="text"
              placeholder="Search body..."
              class="form-input w-full pr-9"
              @keyup.enter="applyFilters"
            />
            <button
              v-if="filters.keyword_body"
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
              aria-label="Clear body keyword"
              @click="clearKeyword('keyword_body')"
            >
              ×
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Mod start</label>
          <div class="relative">
            <input v-model="filters.start_date" type="date" class="form-input w-full pr-9" />
            <button
              v-if="filters.start_date"
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
              aria-label="Clear start date"
              @click="clearDate('start_date')"
            >
              ×
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Mod end</label>
          <div class="relative">
            <input v-model="filters.end_date" type="date" class="form-input w-full pr-9" />
            <button
              v-if="filters.end_date"
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
              aria-label="Clear end date"
              @click="clearDate('end_date')"
            >
              ×
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Sort by</label>
          <select v-model="filters.sort_by" class="form-input w-full" @change="applyFilters">
            <option value="modification_date">Modification date</option>
            <option value="creation_date">Creation date</option>
            <option value="name">Title</option>
            <option value="folder">Folder</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Sort direction</label>
          <select v-model="filters.sort_dir" class="form-input w-full" @change="applyFilters">
            <option value="DESC">DESC</option>
            <option value="ASC">ASC</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Sticky actions -->
    <div
      class="sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
    >
      <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="applyFilters">
        Search
      </button>
      <button
        type="button"
        class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        @click="clearFilters"
      >
        Clear
      </button>
      <button
        type="button"
        class="btn bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        :disabled="selectedIds.length === 0 || deleting"
        @click="deleteSelected"
      >
        {{ deleting ? 'Deleting…' : `Delete Selected (${selectedIds.length})` }}
      </button>
      <button
        type="button"
        class="btn bg-success-600 text-white hover:bg-success-700 disabled:opacity-50"
        :disabled="exporting"
        @click="exportCsv"
      >
        {{ exporting ? 'Exporting…' : 'Export to CSV' }}
      </button>
      <label class="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          v-model="filters.deleted"
          type="checkbox"
          class="rounded border-gray-300"
          @change="applyFilters"
        />
        Not Deleted
      </label>
      <div class="ml-auto flex items-center gap-2">
        <label class="text-sm text-gray-600 dark:text-gray-400">Per page</label>
        <select v-model.number="perPage" class="form-input" @change="changePerPage">
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading notes…</div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :indeterminate="someSelected"
                  @change="toggleSelectAll"
                />
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              <th class="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Folder</th>
              <th class="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Modified</th>
              <th class="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Body</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="!loading && notes.length === 0">
              <td colspan="5" class="px-3 py-6 text-center text-gray-500">No notes found.</td>
            </tr>
            <tr v-for="note in notes" :key="note.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="px-3 py-3 align-top">
                <input v-model="selectedIds" type="checkbox" :value="note.id" />
              </td>
              <td class="px-3 py-3 align-top font-medium text-gray-900 dark:text-white">
                {{ note.name || '(Untitled)' }}
              </td>
              <td class="px-3 py-3 align-top text-gray-600 dark:text-gray-300">{{ note.folder || '—' }}</td>
              <td class="whitespace-nowrap px-3 py-3 align-top text-gray-600 dark:text-gray-300">
                {{ formatDate(note.modification_date) }}
              </td>
              <td class="px-3 py-3 align-top text-gray-700 dark:text-gray-300">
                <div class="note-body-preview" :title="note.body || ''">{{ note.body || '—' }}</div>
                <button
                  v-if="note.body"
                  type="button"
                  class="mt-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
                  @click="openNoteModal(note)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Showing {{ notes.length ? (page - 1) * perPage + 1 : 0 }}–{{ Math.min(page * perPage, total) }}
        of {{ total }}
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <button
          type="button"
          class="btn border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
          :disabled="page <= 1 || loading"
          @click="goToPage(page - 1)"
        >
          Previous
        </button>
        <template v-for="(item, idx) in pageNumbers" :key="'p-' + idx">
          <span v-if="item === '...'" class="px-2 text-gray-500">…</span>
          <button
            v-else
            type="button"
            class="btn px-3 py-2 text-sm"
            :class="
              item === page
                ? 'bg-primary-500 text-white'
                : 'border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
            "
            :disabled="loading"
            @click="goToPage(item)"
          >
            {{ item }}
          </button>
        </template>
        <button
          type="button"
          class="btn border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
          :disabled="page >= totalPages || loading"
          @click="goToPage(page + 1)"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Note modal -->
    <div
      v-if="viewingNote"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      @click.self="closeNoteModal"
    >
      <div class="absolute inset-0 bg-black/50" @click="closeNoteModal"></div>
      <div
        class="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800"
      >
        <div class="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 class="pr-4 text-xl font-semibold text-gray-900 dark:text-white">
            {{ viewingNote.name || '(Untitled)' }}
          </h2>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="btn bg-primary-500 px-3 py-1.5 text-sm text-white hover:bg-primary-600"
              @click="copyNoteBody"
            >
              {{ copyStatus || 'Copy' }}
            </button>
            <button
              type="button"
              class="text-2xl leading-none text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Close"
              @click="closeNoteModal"
            >
              ×
            </button>
          </div>
        </div>
        <div class="overflow-y-auto px-5 py-4">
          <pre class="note-modal-body m-0 text-gray-800 dark:text-gray-200">{{
            normalizeNoteBody(viewingNote.body)
          }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.note-body-preview {
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.note-modal-body {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}
</style>

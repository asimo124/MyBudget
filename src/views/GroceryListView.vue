<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  clearGroceryItems,
  createGroceryItem,
  groceryItemsFromPlainText,
  groceryItemsToPlainText,
  loadGroceryItems,
  saveGroceryItems,
} from '@/utils/groceryList'

const items = ref([])
const newText = ref('')
const editingId = ref(null)
const editText = ref('')
const message = ref('')
const errorMessage = ref('')
const dragFromIndex = ref(null)
const dragOverIndex = ref(null)
const showClearConfirm = ref(false)
const showImport = ref(false)
const importText = ref('')

const exportText = computed(() => groceryItemsToPlainText(items.value))

function flash(msg, isError = false) {
  if (isError) {
    errorMessage.value = msg
    message.value = ''
  } else {
    message.value = msg
    errorMessage.value = ''
  }
}

function persist() {
  if (!saveGroceryItems(items.value)) {
    flash('Could not save to local storage.', true)
    return false
  }
  return true
}

function addItem() {
  const text = newText.value.trim()
  if (!text) {
    flash('Enter an item name.', true)
    return
  }
  items.value.push(createGroceryItem(text))
  newText.value = ''
  persist()
  flash('Item added.')
}

function startEdit(item) {
  editingId.value = item.id
  editText.value = item.text
}

function cancelEdit() {
  editingId.value = null
  editText.value = ''
}

function saveEdit(item) {
  const text = editText.value.trim()
  if (!text) {
    flash('Item cannot be empty.', true)
    return
  }
  item.text = text
  editingId.value = null
  editText.value = ''
  persist()
  flash('Item updated.')
}

function removeItem(id) {
  items.value = items.value.filter((item) => item.id !== id)
  if (editingId.value === id) cancelEdit()
  persist()
  flash('Item deleted.')
}

function toggleMarked(item) {
  if (editingId.value === item.id) return
  item.is_marked = item.is_marked ? 0 : 1
  persist()
}

function confirmClear() {
  clearGroceryItems()
  items.value = []
  cancelEdit()
  showClearConfirm.value = false
  flash('Grocery list cleared from local storage.')
}

async function copyExport() {
  const text = exportText.value
  if (!text) {
    flash('Nothing to export.', true)
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    flash('Copied as plain text — paste into Notes.')
  } catch {
    // Fallback for older Safari / insecure contexts
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      flash('Copied as plain text — paste into Notes.')
    } catch {
      flash('Could not copy. Use Download instead.', true)
    }
  }
}

function downloadExport() {
  const text = exportText.value
  if (!text) {
    flash('Nothing to export.', true)
    return
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'grocery-list.txt'
  a.click()
  URL.revokeObjectURL(url)
  flash('Downloaded grocery-list.txt')
}

function openImport() {
  importText.value = exportText.value
  showImport.value = true
}

function closeImport() {
  showImport.value = false
  importText.value = ''
}

function applyImport() {
  const next = groceryItemsFromPlainText(importText.value)
  if (!next.length) {
    flash('Paste at least one non-empty line.', true)
    return
  }
  items.value = next
  cancelEdit()
  persist()
  closeImport()
  flash(`Imported ${next.length} item${next.length === 1 ? '' : 's'}.`)
}

function onDragStart(index, event) {
  dragFromIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
}

function onDragOver(index, event) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

function onDrop(toIndex, event) {
  event.preventDefault()
  const fromIndex = dragFromIndex.value
  dragFromIndex.value = null
  dragOverIndex.value = null
  if (fromIndex == null || fromIndex === toIndex) return
  const next = [...items.value]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  items.value = next
  persist()
}

function onDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function moveItem(index, delta) {
  const toIndex = index + delta
  if (toIndex < 0 || toIndex >= items.value.length) return
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  next.splice(toIndex, 0, moved)
  items.value = next
  persist()
}

onMounted(() => {
  items.value = loadGroceryItems()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Grocery List</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Add items, drag to reorder, edit or delete. Saved in this browser only. Export as plain text
        for Apple Notes.
      </p>
    </div>

    <div
      v-if="message"
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
    >
      {{ message }}
    </div>
    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ errorMessage }}
    </div>

    <div class="card">
      <div class="card-body space-y-4">
        <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="addItem">
          <input
            v-model="newText"
            type="text"
            class="form-input w-full flex-1"
            placeholder="Add grocery item…"
            autocomplete="off"
          />
          <button type="submit" class="btn bg-primary-500 text-white hover:bg-primary-600 sm:shrink-0">
            Add
          </button>
        </form>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn bg-info-500 text-white hover:bg-info-600"
            :disabled="!items.length"
            @click="copyExport"
          >
            Copy for Notes
          </button>
          <button
            type="button"
            class="btn bg-neutral-200 text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200"
            :disabled="!items.length"
            @click="downloadExport"
          >
            Download .txt
          </button>
          <button
            type="button"
            class="btn bg-primary-500 text-white hover:bg-primary-600"
            @click="openImport"
          >
            Import
          </button>
          <button
            type="button"
            class="btn bg-danger-500 text-white hover:bg-danger-600"
            :disabled="!items.length"
            @click="showClearConfirm = true"
          >
            Clear Local Storage
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <p v-if="!items.length" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No items yet. Add something above.
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="(item, index) in items"
            :key="item.id"
            draggable="true"
            class="flex cursor-pointer items-stretch gap-2 rounded-xl border p-2 transition-colors"
            :class="{
              'opacity-50': dragFromIndex === index,
              'border-primary-400 ring-1 ring-primary-400': dragOverIndex === index,
              'border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-900/40':
                item.is_marked && dragOverIndex !== index,
              'border-neutral-200 bg-white dark:border-neutral-600 dark:bg-dark-2':
                !item.is_marked && dragOverIndex !== index,
            }"
            @click="toggleMarked(item)"
            @dragstart="onDragStart(index, $event)"
            @dragover="onDragOver(index, $event)"
            @dragleave="onDragLeave"
            @drop="onDrop(index, $event)"
            @dragend="onDragEnd"
          >
            <button
              type="button"
              class="flex cursor-grab items-center px-2 text-neutral-400 active:cursor-grabbing"
              title="Drag to reorder"
              aria-label="Drag to reorder"
              @click.stop.prevent
            >
              <i class="ph ph-dots-six-vertical text-xl"></i>
            </button>

            <div class="min-w-0 flex-1">
              <template v-if="editingId === item.id">
                <div class="flex flex-col gap-2 sm:flex-row" @click.stop>
                  <input
                    v-model="editText"
                    type="text"
                    class="form-input w-full"
                    @keydown.enter.prevent="saveEdit(item)"
                    @keydown.esc.prevent="cancelEdit"
                  />
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="btn bg-primary-500 px-3 py-2 text-sm text-white hover:bg-primary-600"
                      @click="saveEdit(item)"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      class="btn bg-neutral-200 px-3 py-2 text-sm text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
                      @click="cancelEdit"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </template>
              <template v-else>
                <p class="px-1 py-2 text-sm text-neutral-900 dark:text-white">{{ item.text }}</p>
              </template>
            </div>

            <div
              v-if="editingId !== item.id"
              class="flex shrink-0 items-center gap-1"
              @click.stop
            >
              <button
                type="button"
                class="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                :disabled="index === 0"
                title="Move up"
                @click="moveItem(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                :disabled="index === items.length - 1"
                title="Move down"
                @click="moveItem(index, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                @click="startEdit(item)"
              >
                Edit
              </button>
              <button
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                @click="removeItem(item.id)"
              >
                Delete
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="items.length" class="card">
      <div class="card-body space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">Export preview</h2>
        <pre
          class="overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm text-neutral-800 dark:bg-dark-3 dark:text-neutral-200"
        >{{ exportText }}</pre>
      </div>
    </div>

    <div
      v-if="showImport"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      @click.self="closeImport"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-2">
        <h3 class="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">Import grocery list</h3>
        <p class="mb-4 text-sm text-neutral-600 dark:text-neutral-300">
          Paste plain text from Notes (one item per line). This replaces your current list.
        </p>
        <textarea
          v-model="importText"
          rows="12"
          class="form-input mb-4 w-full font-mono text-sm"
          placeholder="Milk&#10;Eggs&#10;Bread"
        />
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="btn bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
            @click="closeImport"
          >
            Cancel
          </button>
          <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="applyImport">
            Import
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showClearConfirm"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      @click.self="showClearConfirm = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-2">
        <h3 class="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">Clear grocery list?</h3>
        <p class="mb-6 text-sm text-neutral-600 dark:text-neutral-300">
          This removes all grocery items from local storage on this device. This cannot be undone.
        </p>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="btn bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
            @click="showClearConfirm = false"
          >
            Cancel
          </button>
          <button type="button" class="btn bg-danger-500 text-white hover:bg-danger-600" @click="confirmClear">
            Clear Local Storage
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

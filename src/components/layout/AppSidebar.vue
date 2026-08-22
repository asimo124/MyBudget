<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { navGroups } from '@/config/nav'

const route = useRoute()
const activeGroupId = ref('main')
const isCollapsed = ref(false)
const isMobileOpen = ref(false)

const emit = defineEmits(['collapse-change'])

const activeGroup = computed(
  () => navGroups.find((g) => g.id === activeGroupId.value) || navGroups[0]
)

function pathMatches(path) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function syncActiveGroupFromRoute() {
  for (const group of navGroups) {
    if (group.items.some((item) => item.path && pathMatches(item.path))) {
      activeGroupId.value = group.id
      return
    }
  }
}

function selectGroup(id) {
  activeGroupId.value = id
  if (isCollapsed.value) {
    isCollapsed.value = false
    document.body.classList.remove('twin-collapsed')
    emit('collapse-change', false)
  }
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  document.body.classList.toggle('twin-collapsed', isCollapsed.value)
  emit('collapse-change', isCollapsed.value)
}

function openMobile() {
  isMobileOpen.value = true
}

function closeMobile() {
  isMobileOpen.value = false
}

function onCollapseClick() {
  toggleCollapse()
}

watch(
  () => route.path,
  () => {
    syncActiveGroupFromRoute()
    closeMobile()
  }
)

onMounted(() => {
  syncActiveGroupFromRoute()
  window.addEventListener('mybudget:toggle-sidebar', onCollapseClick)
  window.addEventListener('mybudget:open-mobile-sidebar', openMobile)
})

onUnmounted(() => {
  window.removeEventListener('mybudget:toggle-sidebar', onCollapseClick)
  window.removeEventListener('mybudget:open-mobile-sidebar', openMobile)
  document.body.classList.remove('twin-collapsed')
})

defineExpose({ toggleCollapse, openMobile, closeMobile })
</script>

<template>
  <button type="button" class="twin-mobile-toggle" aria-label="Open menu" @click="openMobile">
    <i class="ph ph-list"></i>
  </button>
  <div class="twin-backdrop" :class="{ show: isMobileOpen }" @click="closeMobile"></div>

  <aside
    class="twin-sidebar"
    :class="{ 'is-collapsed': isCollapsed, 'is-open': isMobileOpen }"
    aria-label="Primary navigation"
  >
    <div class="twin-rail">
      <RouterLink to="/bills-admin" class="twin-rail__brand" aria-label="MyBudget home">
        <img src="/images/logo-icon.png" alt="MyBudget" />
      </RouterLink>

      <div class="twin-rail__nav">
        <button
          v-for="group in navGroups"
          :key="group.id"
          type="button"
          class="rail-icon"
          :class="{ active: activeGroupId === group.id }"
          :aria-label="group.label"
          @click="selectGroup(group.id)"
        >
          <i class="ph" :class="group.icon"></i>
          <span class="rail-tip">{{ group.label }}</span>
        </button>
      </div>
    </div>

    <div class="twin-panel">
      <div class="twin-panel__head">
        <RouterLink to="/bills-admin" class="twin-panel__logo" aria-label="MyBudget">
          MyBudget
        </RouterLink>
      </div>

      <div class="twin-panel__body">
        <ul class="twin-menu active">
          <li
            v-for="item in activeGroup.items"
            :key="item.path || item.href"
            :class="{ active: item.path && pathMatches(item.path) }"
          >
            <a
              v-if="item.external"
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i class="ph" :class="item.icon"></i>
              <span>{{ item.name }}</span>
            </a>
            <RouterLink v-else :to="item.path">
              <i class="ph" :class="item.icon"></i>
              <span>{{ item.name }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <div class="twin-panel__foot">
        <span class="twin-version">MyBudget v1.0</span>
      </div>
    </div>
  </aside>
</template>

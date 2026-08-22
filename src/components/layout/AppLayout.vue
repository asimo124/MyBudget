<script setup>
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppNavbar from '@/components/layout/AppNavbar.vue'
</script>

<template>
  <div class="min-h-screen">
    <AppSidebar />
    <main class="dashboard-main">
      <AppNavbar />
      <div class="dashboard-main-body">
        <RouterView />
      </div>
    </main>
  </div>
</template>

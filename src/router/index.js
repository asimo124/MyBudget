import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { navGroups } from '@/config/nav'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoginView from '@/views/LoginView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import BillsAdminView from '@/views/BillsAdminView.vue'
import BillFormView from '@/views/BillFormView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import BudgetProgressView from '@/views/BudgetProgressView.vue'

function slugToName(path) {
  return path.replace(/^\//, '').replace(/\//g, '-')
}

const REAL_VIEWS = {
  'bills-admin': BillsAdminView,
  expenses: ExpensesView,
  'budget-progress': BudgetProgressView,
}

const placeholderChildren = []
for (const group of navGroups) {
  for (const item of group.items) {
    if (!item.path) continue
    const name = slugToName(item.path)
    const path = item.path.replace(/^\//, '')
    if (REAL_VIEWS[name]) {
      placeholderChildren.push({
        path,
        name,
        component: REAL_VIEWS[name],
        meta: { requiresAuth: true, title: item.name },
      })
    } else {
      placeholderChildren.push({
        path,
        name,
        component: PlaceholderView,
        props: { title: item.name },
        meta: { requiresAuth: true, title: item.name },
      })
    }
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guest: true },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'bills-admin' } },
        {
          path: 'bills-admin/create',
          name: 'bills-admin-create',
          component: BillFormView,
          props: { mode: 'create' },
          meta: { requiresAuth: true, title: 'Create Bill' },
        },
        {
          path: 'bills-admin/edit/:id',
          name: 'bills-admin-edit',
          component: BillFormView,
          props: { mode: 'edit' },
          meta: { requiresAuth: true, title: 'Edit Bill' },
        },
        ...placeholderChildren,
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'bills-admin' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'bills-admin' }
  }

  if (to.meta.requiresAuth && auth.isAuthenticated && !auth.user) {
    await auth.fetchMe()
  }

  return true
})

export default router

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { navGroups } from '@/config/nav'
import { safeRedirectPath } from '@/utils/safeRedirect'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoginView from '@/views/LoginView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import BillsAdminView from '@/views/BillsAdminView.vue'
import BillFormView from '@/views/BillFormView.vue'
import ExpensesView from '@/views/ExpensesView.vue'
import BudgetProgressView from '@/views/BudgetProgressView.vue'
import DisposableIncomeTrackerView from '@/views/DisposableIncomeTrackerView.vue'
import CreditUtilizationView from '@/views/CreditUtilizationView.vue'
import CreditLoanFormView from '@/views/CreditLoanFormView.vue'
import LoanCountdownView from '@/views/LoanCountdownView.vue'
import AuditExpensesView from '@/views/AuditExpensesView.vue'
import GoogleMapsView from '@/views/GoogleMapsView.vue'
import DietaryLogView from '@/views/DietaryLogView.vue'
import PushNotificationsView from '@/views/PushNotificationsView.vue'
import PushNotificationFormView from '@/views/PushNotificationFormView.vue'
import PushScheduleFormView from '@/views/PushScheduleFormView.vue'
import AppleNotesView from '@/views/AppleNotesView.vue'
import DisposableBalancerView from '@/views/DisposableBalancerView.vue'
import FoodSensitivitiesView from '@/views/FoodSensitivitiesView.vue'
import SettingsView from '@/views/SettingsView.vue'

function slugToName(path) {
  return path.replace(/^\//, '').replace(/\//g, '-')
}

const REAL_VIEWS = {
  'bills-admin': BillsAdminView,
  expenses: ExpensesView,
  'budget-progress': BudgetProgressView,
  'disposable-tracker': DisposableIncomeTrackerView,
  'disposable-balancer': DisposableBalancerView,
  'credit-utilization': CreditUtilizationView,
  'loan-countdown': LoanCountdownView,
  'audit-expenses': AuditExpensesView,
  'google-maps': GoogleMapsView,
  'dietary-log': DietaryLogView,
  'push-notifications': PushNotificationsView,
  'apple-notes': AppleNotesView,
  'food-sensitivities': FoodSensitivitiesView,
  settings: SettingsView,
}

const REAL_VIEW_TITLES = Object.fromEntries(
  navGroups.flatMap((group) =>
    group.items
      .filter((item) => item.path)
      .map((item) => [slugToName(item.path), item.name])
  )
)

const placeholderChildren = []
const registeredNames = new Set()

for (const group of navGroups) {
  for (const item of group.items) {
    if (!item.path) continue
    const name = slugToName(item.path)
    const path = item.path.replace(/^\//, '')
    registeredNames.add(name)
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

// Ensure deep links work even if a route is removed from nav.js
for (const [name, component] of Object.entries(REAL_VIEWS)) {
  if (registeredNames.has(name)) continue
  placeholderChildren.push({
    path: name,
    name,
    component,
    meta: { requiresAuth: true, title: REAL_VIEW_TITLES[name] || name },
  })
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
        {
          path: 'credit-utilization/create',
          name: 'credit-utilization-create',
          component: CreditLoanFormView,
          props: { mode: 'create' },
          meta: { requiresAuth: true, title: 'Create Loan/Card' },
        },
        {
          path: 'credit-utilization/edit/:id',
          name: 'credit-utilization-edit',
          component: CreditLoanFormView,
          props: { mode: 'edit' },
          meta: { requiresAuth: true, title: 'Edit Loan/Card' },
        },
        {
          path: 'push-notifications/create',
          name: 'push-notifications-create',
          component: PushNotificationFormView,
          props: { mode: 'create' },
          meta: { requiresAuth: true, title: 'Create Reminder' },
        },
        {
          path: 'push-notifications/edit/:id',
          name: 'push-notifications-edit',
          component: PushNotificationFormView,
          props: { mode: 'edit' },
          meta: { requiresAuth: true, title: 'Edit Reminder' },
        },
        {
          path: 'push-notifications/schedules/create',
          name: 'push-schedules-create',
          component: PushScheduleFormView,
          props: { mode: 'create' },
          meta: { requiresAuth: true, title: 'Create Schedule' },
        },
        {
          path: 'push-notifications/schedules/edit/:id',
          name: 'push-schedules-edit',
          component: PushScheduleFormView,
          props: { mode: 'edit' },
          meta: { requiresAuth: true, title: 'Edit Schedule' },
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
    const redirect = safeRedirectPath(to.query.redirect)
    if (redirect) {
      return redirect
    }
    return { name: 'bills-admin' }
  }

  if (to.meta.requiresAuth && auth.isAuthenticated && !auth.user) {
    await auth.fetchMe()
  }

  return true
})

export default router

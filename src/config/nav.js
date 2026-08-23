export const EXTERNAL_BILLS_URL =
  import.meta.env.VITE_BILLS_EXTERNAL_URL ||
  'https://budget2.hawleywebdesign.com/index.html'

/**
 * Merged nav from BillsSite templates/nav.php + nav4.php.
 * Bills (Angular root app) stays external — not recreated here.
 * Placeholder ("Coming Soon") items are commented out until ported.
 */
export const navGroups = [
  {
    id: 'main',
    label: 'Main',
    icon: 'ph-house-simple',
    items: [
      {
        name: 'Bills',
        external: true,
        href: EXTERNAL_BILLS_URL,
        icon: 'ph-calendar-blank',
      },
      {
        name: 'Add Expense',
        path: '/expenses',
        icon: 'ph-plus-circle',
      },
      {
        name: 'Bills Admin',
        path: '/bills-admin',
        icon: 'ph-list-checks',
      },
      // { name: 'Upcoming Expenses', path: '/upcoming-expenses', icon: 'ph-clock' },
    ],
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: 'ph-wallet',
    items: [
      { name: 'Budget Progress', path: '/budget-progress', icon: 'ph-chart-line-up' },
      // { name: 'Track Progress', path: '/track-progress', icon: 'ph-target' },
      // { name: 'Income Purchases', path: '/income-purchases', icon: 'ph-shopping-cart' },
      { name: 'Disposable Balancer', path: '/disposable-balancer', icon: 'ph-scales' },
      { name: 'Loan Countdown', path: '/loan-countdown', icon: 'ph-timer' },
      { name: 'Credit Utilization', path: '/credit-utilization', icon: 'ph-credit-card' },
      { name: 'Disposable Tracker', path: '/disposable-tracker', icon: 'ph-chart-bar' },
      // { name: 'Queue Date Job', path: '/queue-date-job', icon: 'ph-queue' },
      { name: 'Audit Expenses', path: '/audit-expenses', icon: 'ph-magnifying-glass' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'ph-gear-six',
    items: [
      { name: 'Apple Notes', path: '/apple-notes', icon: 'ph-note' },
      // { name: 'Weight Ratio', path: '/weight-ratio', icon: 'ph-person' },
      { name: 'Dietary Log', path: '/dietary-log', icon: 'ph-fork-knife' },
      { name: 'Food Sensitivities', path: '/food-sensitivities', icon: 'ph-warning' },
      { name: 'Push Notifications', path: '/push-notifications', icon: 'ph-bell' },
      { name: 'Google Maps', path: '/google-maps', icon: 'ph-map-pin' },
      // { name: 'Last Time I', path: '/last-time-i', icon: 'ph-clock-countdown' },
      // { name: 'Pending Transactions', path: '/pending-transactions', icon: 'ph-arrows-left-right' },
      // { name: 'Debt Progress', path: '/debt-progress', icon: 'ph-trend-down' },
    ],
  },
  // {
  //   id: 'charges',
  //   label: 'Charges',
  //   icon: 'ph-receipt',
  //   items: [
  //     { name: 'Charges Chart', path: '/charges/chart', icon: 'ph-chart-pie' },
  //     { name: 'Upload Charges', path: '/charges/upload', icon: 'ph-upload-simple' },
  //     { name: 'Categorize Charges', path: '/charges/categorize', icon: 'ph-tag' },
  //     { name: 'Charge Categories', path: '/charges/categories', icon: 'ph-folders' },
  //     { name: 'Manage Desc', path: '/charges/manage-desc', icon: 'ph-textbox' },
  //   ],
  // },
  {
    id: 'other',
    label: 'Other',
    icon: 'ph-squares-four',
    items: [
      { name: 'Settings', path: '/settings', icon: 'ph-sliders' },
      // { name: 'Audit', path: '/audit', icon: 'ph-shield-check' },
      // { name: 'Eating Out', path: '/eating-out', icon: 'ph-storefront' },
      // { name: 'Cards Info', path: '/cards', icon: 'ph-identification-card' },
    ],
  },
]

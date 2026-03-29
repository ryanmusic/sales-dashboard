export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function subscriptionLabel(level: string, t?: (key: any) => string): string {
  if (t) {
    const keyMap: Record<string, string> = {
      free: 'subFree',
      commission_needed: 'subCommissionOnly',
      subscription_needed: 'subSubscriptionNeeded',
      plan_lightweight: 'subLightweight',
      plan_standard: 'subStandard',
      plan_advanced: 'subAdvanced',
      plan_enterprise: 'subEnterprise',
      monthly_plan_1: 'subSingleStore',
      monthly_plan_2: 'sub2Stores',
      monthly_plan_3: 'sub3to5Stores',
      monthly_plan_6: 'sub6PlusStores',
      monthly_plan_unlimited: 'subUnlimited',
    };
    const key = keyMap[level];
    if (key) return t(key);
  }
  const labels: Record<string, string> = {
    free: 'Free',
    commission_needed: 'Commission Only',
    subscription_needed: 'Subscription Needed',
    plan_lightweight: 'Lightweight',
    plan_standard: 'Standard',
    plan_advanced: 'Advanced',
    plan_enterprise: 'Enterprise',
    monthly_plan_1: 'Single Store',
    monthly_plan_2: '2 Stores',
    monthly_plan_3: '3-5 Stores',
    monthly_plan_6: '6+ Stores',
    monthly_plan_unlimited: 'Unlimited',
  };
  return labels[level] || level;
}

export function statusLabel(status: string, t?: (key: any) => string): string {
  if (t) {
    const keyMap: Record<string, string> = {
      pending: 'statusPending',
      approved: 'statusApproved',
      processing: 'statusProcessing',
      wired_successful: 'statusWiredSuccessful',
      rejected: 'statusRejected',
      cancelled: 'statusCancelled',
      wire_failed: 'statusWireFailed',
      succeeded: 'statusSucceeded',
      failed: 'statusFailed',
    };
    const key = keyMap[status];
    if (key) return t(key);
  }
  return status;
}

export function statusClass(status: string): string {
  const map: Record<string, string> = {
    succeeded: 'badge-success',
    approved: 'badge-success',
    wired_successful: 'badge-success',
    active: 'badge-success',
    pending: 'badge-warning',
    processing: 'badge-info',
    failed: 'badge-error',
    rejected: 'badge-error',
    wire_failed: 'badge-error',
    cancelled: 'badge-neutral',
  };
  return map[status] || 'badge-neutral';
}

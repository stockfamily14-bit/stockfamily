export async function getUserSubscription(userId?: string) {
  return {
    subscribed: true,
    plan: 'pro',
    tier: 'pro'
  };
}

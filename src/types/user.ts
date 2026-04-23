export interface Profile {
  id: string;
  email: string | null;
  subscription_tier: 'free' | 'pro';
  created_at: string;
  updated_at: string;
}

export type SubscriptionTier = Profile['subscription_tier'];

import { createClient } from '@/lib/supabase/server';

export async function checkFeatureEntitlement(workspaceId: string, feature: 'advanced_editor' | 'analytics' | 'unlimited_campaigns') {
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from('workspace_subscriptions')
    .select('tier, status')
    .eq('workspace_id', workspaceId)
    .single();

  const tier = subscription?.tier || 'free';
  const isActive = subscription?.status === 'active';

  // Free tier rules
  if (tier === 'free' || !isActive) {
    if (feature === 'advanced_editor') return false;
    if (feature === 'analytics') return false;
    if (feature === 'unlimited_campaigns') {
       // Check current usage
       const { count } = await supabase
         .from('campaigns')
         .select('*', { count: 'exact', head: true })
         .eq('workspace_id', workspaceId);

       return (count || 0) < 3; // Max 3 campaigns on free tier
    }
  }

  // Pro tier rules
  if (tier === 'pro' && isActive) {
    return true; // Pro has all features
  }

  return false;
}

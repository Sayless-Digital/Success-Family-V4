import LearnMoreView from "./learn-more-view"
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function getLearnPageSettings() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('platform_settings')
    .select(`
      learn_page_video_id,
      learn_page_redirect_link,
      learn_page_video:uploaded_videos!learn_page_video_id(
        id,
        storage_url,
        title
      )
    `)
    .eq('id', 1)
    .single()
  
  const video = Array.isArray(data?.learn_page_video) && data.learn_page_video.length > 0 
    ? data.learn_page_video[0] 
    : null
  
  return {
    videoId: data?.learn_page_video_id || null,
    videoUrl: video?.storage_url || null,
    videoTitle: video?.title || null,
    redirectLink: data?.learn_page_redirect_link || null,
  }
}

export default async function LearnMorePage() {
  const settings = await getLearnPageSettings()
  return <LearnMoreView settings={settings} />
}


















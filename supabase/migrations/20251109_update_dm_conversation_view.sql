-- =============================================
-- UPDATE DM CONVERSATION SUMMARY VIEW
-- Adds other participant status/metadata for client UI
-- =============================================

CREATE OR REPLACE VIEW public.dm_conversation_summaries AS
SELECT
  t.id AS thread_id,
  t.user_a_id,
  t.user_b_id,
  t.initiated_by,
  t.request_required,
  t.request_resolved_at,
  t.last_message_at,
  t.last_message_preview,
  t.last_message_sender_id,
  t.updated_at,
  p.user_id,
  p.status AS participant_status,
  p.last_read_at,
  p.last_seen_at,
  p.muted_at,
  CASE
    WHEN p.user_id = t.user_a_id THEN t.user_b_id
    ELSE t.user_a_id
  END AS other_user_id,
  p_other.status AS other_participant_status,
  p_other.last_read_at AS other_last_read_at,
  p_other.last_seen_at AS other_last_seen_at,
  p_other.muted_at AS other_muted_at
FROM public.dm_threads t
JOIN public.dm_participants p
  ON p.thread_id = t.id
LEFT JOIN public.dm_participants p_other
  ON p_other.thread_id = t.id
 AND p_other.user_id <> p.user_id;

GRANT SELECT ON public.dm_conversation_summaries TO authenticated;

COMMENT ON VIEW public.dm_conversation_summaries
  IS 'Flattened view of DM threads scoped per participant for sidebar rendering, including other participant metadata.';







-- Owner-run, read-only. Edit the four parameters below before executing.
-- Counts people, not taps/transactions. No email, question or device token output.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
WITH parameters AS (
 SELECT DATE '2026-11-01' AS cohort_from_jst,
        DATE '2026-12-01' AS cohort_until_jst, -- exclusive
        INTERVAL '7 days' AS observation_window,
        now() AS as_of
), registrations AS (
 SELECT DISTINCT ON (user_id) user_id, occurred_at AS registered_at,
   CASE properties->>'trialEnabled' WHEN 'true' THEN 'on'
     WHEN 'false' THEN 'off' ELSE 'unknown' END AS trial_at_registration
 FROM public.product_events
 WHERE event='registration_completed' AND user_id IS NOT NULL
 ORDER BY user_id, occurred_at, id
), cohort AS (
 SELECT r.*, (r.registered_at AT TIME ZONE 'Asia/Tokyo')::date AS registration_day_jst,
   r.registered_at+p.observation_window AS observation_end,
   r.registered_at+p.observation_window<=p.as_of AS mature, p.as_of
 FROM registrations r CROSS JOIN parameters p
 WHERE (r.registered_at AT TIME ZONE 'Asia/Tokyo')::date>=p.cohort_from_jst
   AND (r.registered_at AT TIME ZONE 'Asia/Tokyo')::date<p.cohort_until_jst
   AND r.registered_at<=p.as_of
), reach AS (
 SELECT c.user_id,c.registration_day_jst,c.trial_at_registration,c.mature,
   coalesce(bool_or(e.event='timeline_viewed'),false) AS timeline,
   coalesce(bool_or(e.event='book_create_tapped'),false) AS create_tapped,
   coalesce(bool_or(e.event='paywall_viewed'),false) AS paywall,
   coalesce(bool_or(e.event='purchase_completed' AND e.origin='server'
     AND e.properties->>'environment'='Production'),false) AS purchased,
   coalesce(bool_or(e.event='trial_granted' AND e.origin='server'),false) AS trial_granted,
   coalesce(bool_or(e.event='trial_book_ordered' AND e.origin='server'),false) AS trial_ordered,
   coalesce(bool_or(e.event='trial_book_delivered' AND e.origin='server'),false) AS trial_delivered
 FROM cohort c LEFT JOIN public.product_events e ON e.user_id=c.user_id
   AND e.occurred_at>=c.registered_at AND e.occurred_at<c.observation_end
   AND e.occurred_at<=c.as_of
 GROUP BY c.user_id,c.registration_day_jst,c.trial_at_registration,c.mature
)
SELECT registration_day_jst,trial_at_registration,count(*) AS registered_users,
 count(*) FILTER(WHERE mature) AS complete_window_users,
 count(*) FILTER(WHERE timeline) AS timeline_users,
 count(*) FILTER(WHERE create_tapped) AS create_tapped_users,
 count(*) FILTER(WHERE paywall) AS paywall_users,
 count(*) FILTER(WHERE purchased) AS production_purchasers,
 count(*) FILTER(WHERE trial_granted) AS trial_granted_users,
 count(*) FILTER(WHERE trial_ordered) AS trial_ordered_users,
 count(*) FILTER(WHERE trial_delivered) AS trial_delivered_users,
 round(100.0*count(*) FILTER(WHERE mature AND purchased)
   /nullif(count(*) FILTER(WHERE mature),0),2) AS complete_window_purchase_percent
FROM reach GROUP BY registration_day_jst,trial_at_registration
ORDER BY registration_day_jst,trial_at_registration;
ROLLBACK;

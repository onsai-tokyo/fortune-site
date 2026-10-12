-- Owner-run read-only aggregation. No model prices or FX assumptions are embedded.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
WITH calls AS (
 SELECT book_id,lease_id,attempt,call_index,model,prompt_version,
  bool_or(phase='response') AS measured,
  max(provider_model) AS provider_model,
  max(input_tokens) FILTER(WHERE phase='response') AS input_tokens,
  max(output_tokens) FILTER(WHERE phase='response') AS output_tokens,
  max(cache_creation_input_tokens) FILTER(WHERE phase='response') AS cache_write_tokens,
  max(cache_read_input_tokens) FILTER(WHERE phase='response') AS cache_read_tokens
 FROM public.ai_book_usage_events
 WHERE call_index>0
 GROUP BY book_id,lease_id,attempt,call_index,model,prompt_version
)
SELECT model,prompt_version,provider_model,count(*) AS requests,
 count(*) FILTER(WHERE measured) AS measured_requests,
 count(*) FILTER(WHERE NOT measured) AS unknown_usage_requests,
 count(DISTINCT book_id) AS books,
 sum(input_tokens) AS known_input_tokens,sum(output_tokens) AS known_output_tokens,
 sum(cache_write_tokens) AS known_cache_write_tokens,sum(cache_read_tokens) AS known_cache_read_tokens
FROM calls GROUP BY model,prompt_version,provider_model ORDER BY model,prompt_version,provider_model;
ROLLBACK;

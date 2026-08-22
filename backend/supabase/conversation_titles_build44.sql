-- Build 43で付与した診断日は一覧のcreated_at表示と重複するため、既存行から除去する。
update public.reading_conversations
set title = regexp_replace(title, '　診断日 [0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日$', '')
where title ~ '　診断日 [0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日$';

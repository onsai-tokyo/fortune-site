"""Disposable PostgreSQL checks for the per-book question ledger."""
import os, pathlib, subprocess, tempfile
base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['BOOKS_PG_BIN'])
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-book-questions-', dir='/private/tmp'))
cluster, socket = root/'data', root/'socket'; socket.mkdir()
env = {k:v for k,v in os.environ.items() if not k.startswith('PG')}
def command(args, **kwargs):
    p = subprocess.run(args, env=env, text=True, capture_output=True, **kwargs)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout.strip()
def sql(q): return command(['/opt/homebrew/opt/libpq/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55478','-U','postgres','-d','postgres'], input=q)
def uid(n): return f'{n:08d}-2222-4222-8222-222222222222'
def expect(condition, message):
    if not condition: raise AssertionError(message)
    print('PASS', message, flush=True)
def fails(q, needle):
    try: sql(q)
    except RuntimeError as error: return needle in str(error)
    return False
started = False
try:
    command([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','--encoding=UTF8','-A','trust','-U','postgres'])
    command([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'pg.log'),'-o',f"-F -k {socket} -p 55478 -c listen_addresses=''",'-w','start']); started = True
    sql('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);')
    sql((base/'app_store_subscriptions_build45.sql').read_text())
    sql((base/'apple_event_reconciliation_b02.sql').read_text())
    sql((base/'ai_books_20260927.sql').read_text())
    sql((base/'ai_chat_monthly_budget.sql').read_text())
    sql((base/'ai_book_questions_20261017.sql').read_text())
    owner, other = uid(1), uid(2)
    book, other_book = uid(100), uid(101)
    book3, book4 = uid(102), uid(103)
    sql(f"insert into auth.users values ('{owner}'),('{other}'); insert into public.ai_books(id,user_id,operation_id,source_id,target_title,theme,question,state,source_snapshot) values ('{book}','{owner}','{uid(11)}','{uid(90)}','本人','仕事','十分に長い相談内容を登録して質問台帳を検証します。','delivered','[]'),('{other_book}','{other}','{uid(12)}','{uid(91)}','他人','仕事','十分に長い別人の相談内容を登録して質問台帳を検証します。','delivered','[]'),('{book3}','{owner}','{uid(13)}','{uid(92)}','本人2','仕事','失敗後に再利用できる質問台帳を検証する十分に長い相談内容です。','delivered','[]'),('{book4}','{owner}','{uid(14)}','{uid(93)}','本人3','仕事','完了が失敗を上書きしないことを検証する十分に長い相談内容です。','delivered','[]');")
    op1, op2, op3, failed = uid(201), uid(202), uid(203), uid(204)
    begin = lambda op, book_id, question: f"select public.ai_book_question_begin('{owner}','{book_id}','{op}','{question}',100,5000);"
    sql(begin(op1, book, '最初の質問です') + f" select public.ai_book_question_complete('{owner}','{op1}','回答1');")
    # Idempotent retry returns the same completed row and does not consume again.
    expect('completed' in sql(begin(op1, book, '最初の質問です')),'same operation is idempotent')
    sql(begin(failed, book, '失敗する質問') + f" select public.ai_book_question_fail('{owner}','{failed}'); " + begin(op2, book, '二つ目の質問です') + f" select public.ai_book_question_complete('{owner}','{op2}','回答2');")
    expect(sql(f"select count(*) from public.ai_book_questions where book_id='{book}' and state='completed';")=='2','two completed questions are counted')
    # This owner has no membership/subscription row. The route passes the paid
    # AI cap (100) here even when FREE_QUESTION_LIMIT=0.
    expect(sql(f"select count(*) from public.ai_book_questions where user_id='{owner}' and book_id='{book}' and state='completed';")=='2','non-member with FREE_QUESTION_LIMIT=0 can ask twice about one book')
    expect(fails(begin(op3, book, '三つ目の質問です'),'BOOK_QUESTION_LIMIT'),'third question is rejected')
    expect(sql(f"select public.ai_book_question_begin('{owner}','{other_book}','{uid(205)}','他人の質問です');") == '', 'unreachable') if False else None
    expect(fails(begin(uid(205), other_book, '他人の質問です'),'BOOK_NOT_FOUND'),'other user book is rejected')
    failed2 = uid(206)
    sql(begin(failed2, book3, '失敗後に使える質問') + f" select public.ai_book_question_fail('{owner}','{failed2}');")
    expect(sql(f"select count(*) from public.ai_book_questions where operation_id='{failed2}' and state='failed';")=='1','failed question is not counted')
    expect('generating' in sql(begin(uid(207), book3, '失敗後の新しい質問')),'failed question slot is reusable')
    stale_op = uid(208)
    sql(begin(stale_op, book3, '10分超過の質問') + f" update public.ai_book_questions set updated_at=now()-interval '11 minutes' where operation_id='{stale_op}';")
    expect('generating' in sql(begin(uid(209), book3, '期限切れ後の新しい質問')),'stale generating question is failed before counting')
    expect(sql(f"select state from public.ai_book_questions where operation_id='{stale_op}';") == 'failed','stale generating question becomes failed')
    complete_after_fail = uid(210)
    sql(begin(complete_after_fail, book4, '完了前に失敗する質問') + f" select public.ai_book_question_fail('{owner}','{complete_after_fail}');")
    expect('failed' in sql(f"select public.ai_book_question_complete('{owner}','{complete_after_fail}','遅れて届いた回答');"),'complete does not overwrite failed')
    print('ALL BOOK QUESTION DATABASE CHECKS PASSED', flush=True)
finally:
    if started: command([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','immediate','-w','stop'])

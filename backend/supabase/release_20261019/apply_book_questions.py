"""Owner-approved SECOND SQL only. No first/third migration invocation."""
from apply_web_credits import main, QUESTION_MIGRATION


if __name__ == '__main__':
    try:
        raise SystemExit(main(QUESTION_MIGRATION))
    except Exception:
        print('BOOK_QUESTIONS_PRECHECK_FAILED_STOP')
        raise SystemExit(1)

"""Owner-approved THIRD SQL only. No earlier migration or other settings invoked."""
from apply_web_credits import main, SAVES_MIGRATION


if __name__ == '__main__':
    try:
        raise SystemExit(main(SAVES_MIGRATION))
    except Exception:
        print('READING_SAVES_PRECHECK_FAILED_STOP')
        raise SystemExit(1)

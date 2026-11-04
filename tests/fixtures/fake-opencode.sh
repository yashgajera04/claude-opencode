#!/usr/bin/env bash
# Fake `opencode` for tests. Behaviour is chosen with FAKE_MODE.
case "$FAKE_MODE" in
  ok)    echo "done: changed 1 file" ;;
  fail)  echo "boom happened" >&2; exit 1 ;;
  sleep) exec sleep 10 ;;
  big)   head -c 5242880 /dev/zero | tr '\0' 'x'; echo; echo "final line" ;;
  touch)   sleep 2; touch "$FAKE_FILE"; echo done ;;
  bg)      (sleep 2; touch "$FAKE_FILE") & echo "All done"; exit 0 ;;
  failbig) for i in $(seq 1 300); do echo "line $i of noisy output xxxxxxxxxx"; done; for i in $(seq 1 100); do echo "stderr noise $i yyyyyyyyyy" >&2; done; exit 1 ;;
  silent)  echo "permission requested: bash (rm) auto-rejecting" >&2; exit 0 ;;
  tests)echo "implemented hello()"; echo "3 passed, 0 failed" ;;
  args) for a in "$@"; do echo "ARG:$a"; done ;;
  *)     echo "unknown mode" >&2; exit 2 ;;
esac

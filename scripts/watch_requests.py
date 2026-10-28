#!/usr/bin/env python3
"""무중단 배포 실습용 요청 확인 스크립트.

주소의 /version 에 0.2초마다 요청을 보내고, 응답 코드와 응답한 revision 을 기록한다.
연결이 실패하거나 2초 안에 답이 없어도 실패로 센다.
--seconds 로 정한 시간(최대 300초)이 지나거나 Ctrl+C 로 멈추면 요약을 보여 준다.
/version 은 외부 서비스를 부르지 않으므로 오래 돌려도 비용이 들지 않는다.

사용법: python3 scripts/watch_requests.py http://localhost:8080 --seconds 30
"""
import argparse
import json
import socket
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime

INTERVAL = 0.2   # 요청 사이 간격(초)
TIMEOUT = 2.0    # 이 시간 안에 답이 없으면 실패
MAX_SECONDS = 300


def one_request(url):
    """요청 한 번. (상태 코드 또는 None, revision 또는 None, 실패 이유 또는 None)"""
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as res:
            body = json.loads(res.read().decode('utf-8'))
            return res.status, body.get('revision'), None
    except urllib.error.HTTPError as e:      # 서버가 오류 코드를 돌려줌 (예: 502)
        return e.code, None, f'HTTP {e.code}'
    except (socket.timeout, TimeoutError):   # 2초 안에 답이 없음
        return None, None, 'ReadTimeout'
    except urllib.error.URLError as e:       # 연결 자체가 안 됨
        if isinstance(e.reason, (socket.timeout, TimeoutError)):
            return None, None, 'ReadTimeout'
        return None, None, f'ConnectError ({e.reason})'
    except (ConnectionError, OSError, ValueError) as e:
        return None, None, f'{type(e).__name__}'


def main():
    ap = argparse.ArgumentParser(description='/version 에 0.2초마다 요청을 보내 실패와 응답 서버를 센다')
    ap.add_argument('url', help='예: http://localhost:8080')
    ap.add_argument('--seconds', type=float, default=MAX_SECONDS, help=f'측정 시간(초, 최대 {MAX_SECONDS})')
    args = ap.parse_args()

    seconds = min(args.seconds, MAX_SECONDS)
    target = args.url.rstrip('/') + '/version'
    total = 0
    failures = 0
    by_revision = Counter()
    failure_reasons = Counter()
    last_revision = None
    start = time.monotonic()
    print(f'{target} 에 {INTERVAL}초마다 요청합니다 ({seconds:g}초, Ctrl+C 로 중단)')

    try:
        while time.monotonic() - start < seconds:
            tick = time.monotonic()
            status, revision, reason = one_request(target)
            now = datetime.now().strftime('%H:%M:%S.%f')[:-3]
            total += 1
            if reason is not None:
                failures += 1
                failure_reasons[reason] += 1
                print(f'{now}  실패: {reason}')
            else:
                by_revision[revision] += 1
                if revision != last_revision:   # 응답한 쪽이 바뀐 시점만 찍는다
                    print(f'{now}  {status} {revision}' + ('' if last_revision is None else f'   <- {last_revision} 에서 바뀜'))
                    last_revision = revision
            wait = INTERVAL - (time.monotonic() - tick)
            if wait > 0:
                time.sleep(wait)
    except KeyboardInterrupt:
        print('\n중단했습니다.')

    elapsed = time.monotonic() - start
    print('\n===== 요약 =====')
    print(f'측정 시간: {elapsed:.1f}초')
    print(f'전체 요청: {total}')
    print(f'실패: {failures}')
    for reason, n in failure_reasons.most_common():
        print(f'  - {reason}: {n}')
    print('revision 별 응답 수:')
    for rev, n in sorted(by_revision.items(), key=lambda kv: str(kv[0])):
        ratio = n / (total - failures) * 100 if total - failures else 0
        print(f'  - {rev}: {n} ({ratio:.0f}%)')


if __name__ == '__main__':
    main()

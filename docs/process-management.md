# 프로세스 관리 가이드

## 개요

Node.js 서버의 프로세스를 관리하는 방법들을 정리한 문서입니다.

## yarn 명령어

### 서버 시작

**포그라운드 모드 (개발)**
```bash
yarn dev
```

**백그라운드 모드 (개발)**
```bash
yarn dev:bg
```

**백그라운드 모드 (프로덕션)**
```bash
yarn start:bg
```

### 서버 중지

```bash
yarn stop
```

**작동 원리:**
- `.pid` 파일에 저장된 프로세스 ID를 읽음
- `kill` 명령으로 해당 프로세스에 SIGTERM 신호 전송
- `.pid` 파일 삭제 (클린업)

## 수동 프로세스 확인

### PID 파일로 확인

```bash
# PID 파일 내용 확인
cat .pid

# 실제 프로세스 실행 중인지 확인
ps aux | grep $(cat .pid)

# PID 파일 존재 확인
ls -la .pid
```

### 포트로 확인

**기본 포트: 9500**

```bash
# 1. lsof 사용 (가장 간단) - macOS 권장
lsof -i :9500

# 2. netstat 사용
netstat -tulpn | grep 9500

# 3. ss 사용 (최신 Linux 시스템)
ss -tulpn | grep 9500

# 4. fuser 사용
fuser 9500/tcp
```

**예시 결과:**
```
COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     12345  user   20u  IPv4  45678      0t0  TCP *:9500 (LISTEN)
```

### 모든 node 프로세스 확인

```bash
ps aux | grep node
```

## 수동 프로세스 종료

### 방법 1: 직접 PID로 종료 (안전함)

```bash
kill -9 12345
```

### 방법 2: 포트로 자동 종료

```bash
kill -9 $(lsof -t -i :9500)
```

**주의:** 포트 9500에 프로세스가 없으면 에러 발생

### 방법 3: 더 안전한 방법

```bash
lsof -i :9500 | awk 'NR!=1 {print $2}' | xargs kill -9
```

## 트러블슈팅

### "yarn stop" 작동 안 함

```bash
# PID 파일 확인
ls -la .pid

# 수동으로 포트에서 프로세스 확인 후 종료
lsof -i :9500
kill -9 [PID]

# PID 파일 정리
rm .pid
```

### 포트 9500이 이미 사용 중일 때

```bash
# 포트 사용 중인 프로세스 확인
lsof -i :9500

# 강제 종료
kill -9 $(lsof -t -i :9500)

# 또는 다른 포트로 서버 실행
PORT=9501 yarn dev
```

### 좀비 프로세스가 남아있을 때

```bash
# 모든 node 프로세스 확인
ps aux | grep node

# 특정 프로세스 강제 종료
kill -9 [PID]

# 또는 모든 node 프로세스 종료 (주의!)
pkill -9 node
```

## 신호 설명

- `SIGTERM (15)`: 정상 종료 신호 (default)
- `SIGKILL (9)`: 강제 종료 신호 (무조건 죽음)
- `SIGINT (2)`: 인터럽트 신호 (Ctrl+C)

```bash
# SIGTERM으로 정상 종료 시도
kill 12345

# SIGKILL으로 강제 종료
kill -9 12345
```

## 백그라운드 서버 관리

### 시작 후 로그 확인

```bash
yarn dev:bg
tail -f app.log
```

### 로그 조회

```bash
yarn logs
```

### 서버 상태 확인

```bash
# 헬스체크 엔드포인트
curl http://localhost:9500/health

# RDS 모니터링
curl http://localhost:9500/infra/monitor/rds
```

# AWS Infrastructure Monitor

RDS, DynamoDB, WAF 인프라 점검 기능을 제공하는 Fastify 기반 모니터링 서버입니다.

## 설치

```bash
yarn install
cp .env.example .env  # 환경변수 설정 파일 복사
```

## 실행 방법

### 개발 모드 (포그라운드)
```bash
yarn dev
```

### 개발 모드 (백그라운드 - 권장)
```bash
yarn dev:bg
yarn logs  # 로그 보기
yarn stop  # 종료
```

### 프로덕션 모드
```bash
yarn build
yarn start
```

### 프로덕션 모드 (백그라운드)
```bash
yarn build
yarn start:bg
yarn logs  # 로그 보기
yarn stop  # 종료
```

## API 엔드포인트

- `GET /health` - 서버 상태 확인
  - 설정된 알림 채널 (Telegram, Slack)
  - 스케줄러 상태 및 설정
- `POST /infra/monitor?notify=issues` - 전체 인프라 점검 (RDS, DynamoDB, WAF)
  - `?notify=issues` (기본값) - 문제 발생 시만 알림 (Telegram/Slack 모두)
  - `?notify=true` - 전체 리포트 전송 (Telegram/Slack 모두)
  - `?notify=false` - 알림 없음
- `GET /infra/monitor/:service` - 특정 서비스 메트릭 조회 (:service = rds, dynamodb, waf, 알림 없음)

## 스케줄러

서버 시작 시 자동으로 스케줄러가 실행됩니다. `CRON_SCHEDULE` 환경변수로 실행 주기를 설정할 수 있습니다.

```bash
# 기본값: 30분마다 실행
CRON_SCHEDULE="*/30 * * * *" yarn start

# 매시간 실행
CRON_SCHEDULE="0 * * * *" yarn start

# 매일 아침 9시 실행
CRON_SCHEDULE="0 9 * * *" yarn start
```

스케줄러는 설정된 알림 채널(Telegram/Slack)로 `NOTIFY_MODE`에 따라 자동으로 보고서를 전송합니다:
- `issues` - 문제 있을 때만 알림
- `full` - 매번 전체 리포트 전송
- `none` - 알림 없음

## 구조

```
src/
├── infra-monitor/
│   ├── rds.ts          - RDS 모니터링
│   ├── dynamodb.ts     - DynamoDB 모니터링
│   ├── waf.ts          - WAF 모니터링
│   └── index.ts        - 통합 모니터링 로직
├── notifiers/
│   ├── types.ts        - Notifier 인터페이스
│   ├── telegram.ts     - Telegram 알림 구현
│   ├── slack.ts        - Slack 알림 구현
│   └── index.ts        - 통합 알림 발송
├── server.ts           - Fastify 서버
├── types.ts            - TypeScript 타입 정의
└── index.ts            - 진입점
```

## 환경 설정

**.env 파일 (선택사항):**

Telegram 알림:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

Slack 알림:
```
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_CHANNEL_ID=your_slack_channel_id
```

스케줄 설정:
```
CRON_SCHEDULE=*/30 * * * *    # Cron 표현식 (기본값: 30분마다)
NOTIFY_MODE=issues            # 알림 모드: issues, full, none (기본값: issues)
RDS_INSTANCE_NAMES=production-mshuttle,production-mshuttle-read1  # 모니터링할 RDS 인스턴스 (선택사항, 미지정 시 모두)
```

AWS 자격증명:
AWS SDK는 기본 AWS 자격증명을 사용합니다 (AWS_PROFILE, ~/.aws/credentials 등)

### Cron 표현식 예제
- `*/30 * * * *` - 30분마다
- `0 * * * *` - 매시간
- `0 9 * * *` - 매일 9시
- `0 */6 * * *` - 6시간마다
- `0 0 * * *` - 매일 자정

## 점검 항목

### RDS
- CPU 활용도 (80% 이상 시 경고)
- 데이터베이스 연결 수
- 스토리지 용량
- 인스턴스 상태

### DynamoDB
- 읽기/쓰기 용량 소비
- 사용자 에러 (10개 이상 시 경고)
- 시스템 에러 (0개 초과 시 경고)
- 테이블 상태

### WAF
- 차단된 요청 (100개 이상 시 경고)
- 허용된 요청
- 계산된 요청

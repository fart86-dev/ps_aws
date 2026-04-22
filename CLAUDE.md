# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AWS Infrastructure Monitor는 Fastify 기반의 모니터링 API 서버입니다. RDS, DynamoDB, WAF 서비스를 CloudWatch 메트릭으로 모니터링하고, 이슈 발생 시 Telegram으로 알림을 보냅니다.

## Development Commands

```bash
yarn dev          # 개발 모드 (hot reload with tsx watch)
yarn type-check   # TypeScript 타입 검사
yarn build        # 프로덕션 빌드 (dist/ 생성)
yarn start        # 빌드된 코드 실행
```

## Architecture

### High-Level Flow

1. **API Request** → `/infra/monitor/:service` 또는 `/infra/monitor?notify=...`
2. **Service Monitor** → AWS CloudWatch에서 메트릭 조회 (RDS/DynamoDB/WAF 중 요청된 것만)
3. **Error Detection** → 임계값 초과 항목 검출
4. **Telegram Notification** (선택사항) → 이슈 또는 전체 리포트 전송
5. **Response** → JSON 형식으로 메트릭 데이터 반환

### Service-Specific Monitoring

각 서비스는 독립적인 모니터 함수로 구현되어 있어, 요청된 서비스만 AWS API를 호출합니다:

- **RDS** (`src/infra-monitor/rds.ts`): CloudWatch 메트릭 조회 → 인스턴스별 CPU, 연결 수, 스토리지
- **DynamoDB** (`src/infra-monitor/dynamodb.ts`): CloudWatch 메트릭 조회 → 테이블별 읽기/쓰기 용량, 에러율
- **WAF** (`src/infra-monitor/waf.ts`): CloudWatch 메트릭 조회 → Web ACL별 차단/허용/계산 요청

### Integration & Routing

- **src/infra-monitor/index.ts**: `checkInfrastructure()` 함수로 세 서비스 모두 조회 및 이슈 통합
- **src/server.ts**: Fastify 라우팅 및 Telegram 알림 트리거
  - `serviceMonitors` 맵으로 서비스별 모니터 함수 관리 (새 서비스 추가 시 여기에만 등록)
  - `notify` 쿼리 파라미터로 알림 모드 제어

- **src/telegram/notifier.ts**: Telegram API 연동
  - `sendIssueAlert()`: 문제 있는 항목만 알림
  - `sendFullReport()`: 전체 메트릭 리포트 전송
  - 한글 형식의 포맷팅 및 상태 이모지

## Environment Setup

**.env 파일 필수:**
```
BOT_TOKEN=your_telegram_bot_token
CHAT_ID=your_telegram_chat_id
```

**AWS 자격증명:**
- `~/.aws/credentials` 또는 `AWS_PROFILE` 환경변수로 AWS SDK 인증

## Key Design Decisions

1. **요청별 최소 API 호출**: `/infra/monitor/rds` 요청 시 RDS만 조회 (DynamoDB, WAF 미조회)
2. **동적 라우팅**: 새로운 서비스 추가 시 `server.ts`의 `serviceMonitors` 맵에만 등록하면 자동으로 라우트 생성
3. **Telegram 옵션화**: `notify` 파라미터로 알림 모드 선택 가능 (issues, true, false)

## Adding a New Service

1. `src/infra-monitor/newservice.ts` 생성: CloudWatch 메트릭 조회 로직 구현
2. 타입 정의 추가: `src/types.ts`에 `NewServiceMetrics` 인터페이스 추가
3. `src/infra-monitor/index.ts`에 새 모니터 함수 import 및 체크 로직 추가
4. `src/server.ts`의 `serviceMonitors` 맵에 등록: `newservice: monitorNewService`
5. `src/telegram/notifier.ts`에 포맷팅 함수 추가 (선택사항)

## Important Notes

- **TypeScript 엄격 모드**: `tsconfig.json`에서 `strict: true` 설정, 타입 안정성 필수
- **AWS SDK v3**: 각 서비스마다 별도의 클라이언트 (`RDSClient`, `DynamoDBClient`, `WAFV2Client`, `CloudWatchClient`)
- **Fastify 라우팅**: 쿼리 파라미터 검증이 `server.ts`에서 수동으로 처리됨 (OpenAPI 스키마 없음)

# AWS Infrastructure Monitor

RDS, DynamoDB, WAF 인프라 점검 기능을 제공하는 Fastify 기반 모니터링 서버입니다.

## 설치

```bash
yarn install
```

## 개발 실행

```bash
yarn dev
```

## 프로덕션 빌드

```bash
yarn build
yarn start
```

## API 엔드포인트

- `GET /health` - 서버 상태 확인
- `POST /infra/monitor` - 전체 인프라 점검 (RDS, DynamoDB, WAF)
- `GET /infra/monitor/:service` - 특정 서비스 메트릭 조회 (:service = rds, dynamodb, waf)

## 구조

```
src/
├── infra-monitor/
│   ├── rds.ts          - RDS 모니터링
│   ├── dynamodb.ts     - DynamoDB 모니터링
│   ├── waf.ts          - WAF 모니터링
│   └── index.ts        - 통합 모니터링 로직
├── server.ts           - Fastify 서버
├── types.ts            - TypeScript 타입 정의
└── index.ts            - 진입점
```

## 환경 설정

AWS SDK는 기본 AWS 자격증명을 사용합니다 (AWS_PROFILE, ~/.aws/credentials 등)

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

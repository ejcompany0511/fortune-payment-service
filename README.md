# EveryUnse Payment Service

KG Inicis 결제 서비스 - 사주운세 플랫폼용

## 환경 변수 설정

Render에서 다음 환경 변수를 설정하세요:

```
NODE_ENV=production
INICIS_MID=your_inicis_mid
INICIS_SIGNKEY=your_inicis_signkey
INICIS_CHANNEL_KEY=your_channel_key
MAIN_SERVICE_URL=https://www.everyunse.com
WEBHOOK_SECRET=EveryUnse2024PaymentSecureWebhook!@#
```

## 테스트 모드

- 개발 환경 (`NODE_ENV != production`)에서는 자동으로 테스트 모드로 실행
- PC 결제는 시뮬레이션으로 처리
- 모바일 결제는 KG Inicis 테스트 환경 사용

## API 엔드포인트

- `POST /api/create-payment` - 결제 요청 생성
- `POST /api/mobile-payment-complete` - 모바일 결제 완료 처리
- `POST /api/pc-payment-complete` - PC 결제 완료 처리
- `GET /api/payment-session/:sessionId` - 결제 세션 조회
- `GET /health` - 헬스체크

## 배포

GitHub에 푸시하면 Render에서 자동으로 배포됩니다.

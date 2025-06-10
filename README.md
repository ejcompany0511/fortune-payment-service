# EveryUnse Payment Service
KG Inicis 최신 결제 API를 사용한 사주운세 플랫폼용 결제 서비스
## 주요 특징
- **최신 KG Inicis API**: payView.jsp 및 Smart Payment 시스템 사용
- **Mixed Content 문제 해결**: HTTPS 전용 엔드포인트로 보안 강화
- **PC/모바일 자동 감지**: User-Agent 기반 결제 방식 자동 선택
- **테스트/프로덕션 모드**: 환경별 자동 전환
## 환경 변수 설정
Render에서 다음 환경 변수를 설정하세요:
NODE_ENV=production
INICIS_MID=your_inicis_mid
INICIS_SIGNKEY=your_inicis_signkey
MAIN_SERVICE_URL=https://www.everyunse.com
WEBHOOK_SECRET=EveryUnse2024PaymentSecureWebhook!@#

## 결제 URL 업데이트
### PC 결제
- **이전**: `https://stdpay.inicis.com/inicis/std/wpay/pay.jsp` (404 오류)
- **현재**: `https://stdpay.inicis.com/inicis/std/payView.jsp` (정상 작동)
### 모바일 결제
- **URL**: `https://mobile.inicis.com/smart/payment/`
- **추가 옵션**: `P_RESERVED=twotrs_isp=Y&block_isp=Y` (ISP 보안 강화)
## 테스트 모드
- 개발 환경에서는 PC 결제를 시뮬레이션으로 처리
- 모바일 결제는 KG Inicis 테스트 환경 사용
- 웹훅을 통한 메인 서비스 연동
## API 엔드포인트
- `POST /api/create-payment` - 결제 요청 생성 (PC/모바일 자동 감지)
- `POST /api/mobile-payment-complete` - 모바일 결제 완료 처리
- `POST /api/pc-payment-complete` - PC 결제 완료 처리
- `GET /api/payment-session/:sessionId` - 결제 세션 조회
- `GET /health` - 헬스체크
## 배포
GitHub에 푸시하면 Render에서 자동으로 배포됩니다.
## 문제 해결
1. **404 오류**: 최신 payView.jsp 엔드포인트 사용으로 해결
2. **Mixed Content**: HTTPS 전용 리소스 사용으로 보안 경고 제거
3. **세션 추적**: P_SESSIONID 파라미터로 안정적인 세션 관리

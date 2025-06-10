# EveryUnse Payment Service v1.3.0

아임포트 통합 결제 시스템을 사용한 사주운세 플랫폼용 결제 서비스

## 주요 변경사항 (v1.3.0)

- **PC/모바일 통합**: 모든 결제를 아임포트로 통합 처리
- **KG Inicis 완전 제거**: 문제가 있던 KG Inicis 직접 호출 제거
- **모바일 최적화**: 아임포트에서 자동으로 모바일 결제창 최적화
- **안정적인 결제**: PC/모바일 모두 동일한 아임포트 시스템 사용
- **리다이렉트 개선**: 모바일 결제 완료 후 자동 리다이렉트 지원

## 결제 플로우 (통합)

### PC/모바일 공통 결제
1. 클라이언트 → 결제 서비스 API 호출
2. 결제 서비스 → 아임포트 결제 페이지로 리다이렉트
3. 사용자 → 아임포트에서 결제 진행 (PC/모바일 자동 최적화)
4. 아임포트 → 결제 완료 후 검증 API 호출
5. 결제 서비스 → 메인 서비스에 웹훅 전송

### 테스트 모드
- PC/모바일 결제 시뮬레이션 (개발 환경)
- 실제 결제 없이 성공 처리

## 환경 변수

```bash
NODE_ENV=production
MAIN_SERVICE_URL=https://www.everyunse.com
WEBHOOK_SECRET=EveryUnse2024PaymentSecureWebhook!@#

API 엔드포인트
GET /payment - 아임포트 결제 페이지 (PC/모바일 통합)
POST /verify-payment - 아임포트 결제 검증
GET /verify-payment-mobile - 모바일 리다이렉트 처리
POST /api/create-payment - 결제 요청 생성
GET /health - 헬스체크
문제 해결
✅ 404 오류 해결: KG Inicis 직접 호출 완전 제거
✅ Mixed Content 해결: HTTPS 전용 아임포트 사용
✅ 모바일 결제 문제 해결: 아임포트 통합으로 안정성 개선
✅ iframe 제약 해결: 별도 결제 페이지로 우회
✅ PC/모바일 일관성: 동일한 아임포트 시스템 사용

기술적 개선사항
아임포트 테스트 가맹점 코드: imp57573124
PG사: html5_inicis.INIpayTest (테스트용)
모바일 자동 감지 및 최적화
결제 세션 관리 및 자동 정리
웹훅 서명 검증 시스템
이제 PC와 모바일 모두에서 안정적인 결제가 가능합니다.

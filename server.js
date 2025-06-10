const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소 (간단한 세션 관리용)
const paymentSessions = new Map();

app.use(cors({
  origin: ['https://www.everyunse.com', 'https://everyunse.com'],
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// KG Inicis 설정
const INICIS_MID = process.env.INICIS_MID || 'INIpayTest';
const INICIS_SIGNKEY = process.env.INICIS_SIGNKEY || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'EveryUnse2024PaymentSecureWebhook!@#';

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 디버그 엔드포인트 (환경 변수 확인용)
app.get('/debug', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    MAIN_SERVICE_URL: MAIN_SERVICE_URL,
    WEBHOOK_SECRET: WEBHOOK_SECRET ? '***설정됨***' : '설정되지 않음',
    PORT: PORT
  });
});

// 아임포트 결제 페이지
app.get('/payment', (req, res) => {
  const { amount, coins, sessionId, merchant_uid, name } = req.query;
  
  if (!amount || !coins || !sessionId || !merchant_uid) {
    return res.status(400).send('Missing required parameters');
  }

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>결제하기 - EveryUnse</title>
    <script src="https://cdn.iamport.kr/v1/iamport.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
        }
        .amount {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin: 20px 0;
        }
        .coins {
            font-size: 18px;
            color: #666;
            margin-bottom: 30px;
        }
        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 50px;
            cursor: pointer;
            width: 100%;
            margin: 10px 0;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        .loading {
            display: none;
            color: #666;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔮 EveryUnse</div>
        <div>주문번호: ${merchant_uid}</div>
        <div class="amount">${parseFloat(amount).toLocaleString()}원</div>
        <div class="coins">코인: ${coins}개</div>
        
        <button id="payBtn" class="btn" onclick="requestPay()">결제하기</button>
        <div id="loading" class="loading">결제 처리 중...</div>
    </div>

    <script>
        // 아임포트 초기화 - IMP 변수 중복 선언 방지
        if (typeof window.IMP !== 'undefined') {
            window.IMP.init('imp57573124'); // 테스트 가맹점 코드
        } else {
            console.error('IMP library not loaded');
        }
        
        function requestPay() {
            if (!window.IMP) {
                alert('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            
            const payBtn = document.getElementById('payBtn');
            const loading = document.getElementById('loading');
            
            payBtn.disabled = true;
            loading.style.display = 'block';
            
            window.IMP.request_pay({
                pg: 'html5_inicis',
                pay_method: 'card',
                merchant_uid: '${merchant_uid}',
                name: '${name || `${coins}코인 패키지`}',
                amount: ${parseFloat(amount)},
                buyer_email: 'customer@example.com',
                buyer_name: '고객',
                buyer_tel: '010-1234-5678',
                buyer_addr: '서울특별시 강남구 삼성동',
                buyer_postcode: '123-456',
                // 모바일 결제 완료 후 직접 리다이렉트 설정
                m_redirect_url: window.location.origin + '/mobile-payment-complete?sessionId=${sessionId}&merchant_uid=${merchant_uid}'
            }, function (rsp) {
                payBtn.disabled = false;
                loading.style.display = 'none';
                
                if (rsp.success) {
                    // PC 결제 성공 시만 처리 (모바일은 m_redirect_url로 처리됨)
                    fetch('/verify-payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            imp_uid: rsp.imp_uid,
                            merchant_uid: rsp.merchant_uid,
                            sessionId: '${sessionId}',
                            success: true
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('결제가 완료되었습니다!');
                            window.location.href = data.redirectUrl;
                        } else {
                            alert('결제 검증에 실패했습니다: ' + data.error);
                            window.location.href = data.redirectUrl;
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('결제 처리 중 오류가 발생했습니다.');
                        window.location.href = 'https://www.everyunse.com/coins?payment=error';
                    });
                } else {
                    // 결제 실패 시
                    alert('결제가 취소되었습니다: ' + rsp.error_msg);
                    window.location.href = 'https://www.everyunse.com/coins?payment=cancelled';
                }
            });
        }
    </script>
</body>
</html>`;

  res.send(html);
});

// 모바일 결제 완료 처리 (m_redirect_url 콜백)
app.get('/mobile-payment-complete', async (req, res) => {
  const { imp_uid, merchant_uid, imp_success, error_msg, sessionId } = req.query;
  
  console.log('Mobile payment completion:', {
    imp_uid, merchant_uid, imp_success, error_msg, sessionId
  });

  if (imp_success === 'true' && imp_uid && sessionId) {
    // 결제 성공 - 검증 후 메인 서비스 알림
    const sessionData = paymentSessions.get(sessionId);
    
    if (sessionData) {
      sessionData.status = 'completed';
      sessionData.transactionId = imp_uid;
      
      // 메인 서비스에 웹훅 전송
      await notifyMainService(sessionData, 'completed');
      
      // 즉시 메인 사이트로 리다이렉트 (중간 화면 없이)
      res.redirect(`https://www.everyunse.com/coins?payment=success&coins=${sessionData.coins}`);
    } else {
      res.redirect('https://www.everyunse.com/coins?payment=error&message=session_not_found');
    }
  } else {
    // 결제 실패
    res.redirect(`https://www.everyunse.com/coins?payment=error&message=${encodeURIComponent(error_msg || 'payment_failed')}`);
  }
});

// 결제 요청 생성 (PC/모바일 자동 감지)
app.post('/api/create-payment', (req, res) => {
  const { amount, coins, userId, packageId } = req.body;
  
  if (!amount || !coins) {
    return res.status(400).json({ error: 'Amount and coins are required' });
  }

  // 세션 ID 생성
  const sessionId = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString().replace(/[:\-]/g, '').slice(0, 14);
  const orderId = `ORDER_${timestamp}_${sessionId.slice(0, 8)}`;

  // 결제 세션 정보 저장
  const sessionData = {
    amount,
    coins,
    userId,
    packageId,
    orderId,
    sessionId, // 명시적으로 sessionId 저장
    paymentType: 'iamport',
    status: 'pending',
    createdAt: new Date()
  };
  
  paymentSessions.set(sessionId, sessionData);
  console.log('Saved session:', sessionId, sessionData);

  // PC/모바일 모두 아임포트 통합 결제로 처리
  res.json({
    success: true,
    sessionId,
    paymentType: 'pc',
    useIamport: true,
    paymentData: {
      merchant_uid: orderId,
      name: `${coins}코인 패키지`,
      amount: amount,
      buyer_name: '고객',
      buyer_email: 'customer@example.com',
      sessionId: sessionId
    }
  });
});

// 아임포트 결제 검증 API (PC용)
app.post('/verify-payment', async (req, res) => {
  const { imp_uid, merchant_uid, sessionId, success, error_msg } = req.body;

  console.log('Payment verification received:', {
    imp_uid, merchant_uid, sessionId, success, error_msg
  });

  if (!success) {
    return res.json({
      success: false,
      error: error_msg || '결제 실패',
      redirectUrl: `https://www.everyunse.com/coins?payment=error&message=payment_cancelled`
    });
  }

  // sessionId를 직접 사용하거나 merchant_uid에서 추출
  let finalSessionId = sessionId;
  if (!finalSessionId && merchant_uid) {
    finalSessionId = extractSessionFromOID(merchant_uid);
  }
  
  console.log('Looking for sessionId:', finalSessionId);
  const sessionData = paymentSessions.get(finalSessionId);
  
  if (!sessionData) {
    console.log('Session not found for sessionId:', finalSessionId);
    return res.json({
      success: false,
      error: 'Session not found',
      redirectUrl: `https://www.everyunse.com/coins?payment=error&message=session_not_found`
    });
  }

  // 결제 성공 처리
  sessionData.status = 'completed';
  sessionData.transactionId = imp_uid;
  
  // 메인 서비스에 웹훅 전송
  await notifyMainService(sessionData, 'completed');
  
  res.json({
    success: true,
    redirectUrl: `https://www.everyunse.com/coins?payment=success&coins=${sessionData.coins}`
  });
});

// OID에서 sessionId 추출 헬퍼 함수
function extractSessionFromOID(oid) {
  if (!oid) return null;
  const parts = oid.split('_');
  return parts.length >= 3 ? parts[2] : null;
}

// 메인 서비스에 결제 결과 알림
async function notifyMainService(sessionData, status) {
  try {
    const webhookUrl = `${MAIN_SERVICE_URL}/api/payment-webhook`;
    const webhookData = {
      sessionId: sessionData.sessionId || sessionData.orderId,
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      status: status,
      transactionId: sessionData.transactionId,
      timestamp: new Date().toISOString()
    };

    console.log('Sending webhook to:', webhookUrl);
    console.log('Webhook data:', webhookData);

    // 웹훅 서명 생성
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(webhookData))
      .digest('hex');

    console.log('Generated signature:', signature);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature
      },
      body: JSON.stringify(webhookData)
    });

    const responseText = await response.text();
    console.log('Webhook response status:', response.status);
    console.log('Webhook response body:', responseText);

    if (!response.ok) {
      console.error('Failed to notify main service:', response.status, responseText);
    } else {
      console.log('Successfully notified main service');
    }
  } catch (error) {
    console.error('Error notifying main service:', error);
  }
}

// 결제 세션 조회
app.get('/api/payment-session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = paymentSessions.get(sessionId);
  
  if (!sessionData) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(sessionData);
});

// 오래된 세션 정리 (1시간 이상)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [sessionId, sessionData] of paymentSessions.entries()) {
    if (sessionData.createdAt < oneHourAgo) {
      paymentSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // 1시간마다 실행

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Main service URL: ${MAIN_SERVICE_URL}`);
});

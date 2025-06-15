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
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://www.everyunse.com';
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
        .payment-container {
            background: white;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 24px;
        }
        .payment-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .payment-info h3 {
            margin: 0 0 16px 0;
            color: #333;
        }
        .payment-info p {
            margin: 8px 0;
            color: #666;
        }
        .amount {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        .btn {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 16px 32px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
        }
        .btn:hover {
            background: #5a6fd8;
            transform: translateY(-1px);
        }
        .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        .loading {
            display: none;
            margin-top: 16px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="payment-container">
        <div class="logo">🔮 EveryUnse</div>
        
        <div class="payment-info">
            <h3>${name || '코인 패키지'}</h3>
            <p>코인: <strong>${coins}개</strong></p>
            <p class="amount">${Number(amount).toLocaleString()}원</p>
        </div>
        
        <button id="payBtn" class="btn" onclick="requestPay()">
            결제하기
        </button>
        
        <div id="loading" class="loading">
            결제 처리 중입니다...
        </div>
    </div>

    <script>
        // 아임포트 초기화 (테스트용 가맹점 식별코드)
        window.IMP.init('imp57573124'); // 테스트 가맹점 식별코드
        
        function requestPay() {
            const payBtn = document.getElementById('payBtn');
            const loading = document.getElementById('loading');
            
            payBtn.disabled = true;
            loading.style.display = 'block';
            
            window.IMP.request_pay({
                pg: 'html5_inicis.INIpayTest', // 테스트용
                pay_method: 'card',
                merchant_uid: '${merchant_uid}',
                name: '${name || '코인 패키지'}',
                amount: ${amount},
                buyer_email: 'customer@example.com',
                buyer_name: '고객',
                buyer_tel: '010-0000-0000'
            }, function(rsp) {
                if (rsp.success) {
                    // 결제 성공 시 검증 요청
                    fetch('/verify-payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            imp_uid: rsp.imp_uid,
                            merchant_uid: rsp.merchant_uid,
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
                        window.location.href = '${MAIN_SERVICE_URL}/coins?payment=error';
                    });
                } else {
                    // 결제 실패 시
                    fetch('/verify-payment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            imp_uid: rsp.imp_uid,
                            merchant_uid: rsp.merchant_uid,
                            success: false
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        alert('결제가 취소되었습니다: ' + rsp.error_msg);
                        window.location.href = data.redirectUrl;
                    });
                }
            });
        }
        
        // 페이지 로드 시 자동으로 결제 창 호출 (선택사항)
        // window.onload = requestPay;
    </script>
</body>
</html>`;

  res.send(html);
});

// 결제 요청 생성 (PC/모바일 자동 감지)
app.post('/api/create-payment', (req, res) => {
  const { amount, coins, userId, packageId } = req.body;
  
  if (!amount || !coins) {
    return res.status(400).json({ error: 'Amount and coins are required' });
  }

  // User-Agent로 모바일/PC 감지
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

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

  if (isMobile) {
    // 모바일 결제 파라미터 (최신 Smart 결제 시스템)
    const paymentParams = {
      P_INI_PAYMENT: 'CARD',
      P_MID: INICIS_MID,
      P_OID: orderId,
      P_AMT: amount,
      P_GOODS: `${coins}코인 패키지`,
      P_UNAME: '고객',
      P_MOBILE: 'YES',
      P_CHARSET: 'utf8',
      P_SESSIONID: sessionId,
      P_NOTI_URL: `${req.protocol}://${req.get('host')}/api/mobile-payment-complete`,
      P_NEXT_URL: `${req.protocol}://${req.get('host')}/api/mobile-payment-complete`,
      P_RESERVED: 'twotrs_isp=Y&block_isp=Y'
    };

    res.json({
      success: true,
      sessionId,
      paymentType: 'mobile',
      paymentUrl: 'https://mobile.inicis.com/smart/payment/',
      params: paymentParams
    });
  } else {
    // PC 결제 - 테스트 환경에서는 시뮬레이션 모드로 전환
    const isTestMode = process.env.NODE_ENV !== 'production';
    
    if (isTestMode) {
      // 테스트 모드에서는 바로 성공 처리
      setTimeout(async () => {
        await notifyMainService(paymentSessions.get(sessionId), 'completed');
      }, 1000);
      
      res.json({
        success: true,
        sessionId,
        paymentType: 'pc',
        testMode: true,
        message: '테스트 환경에서 결제가 시뮬레이션됩니다.'
      });
    } else {
      // PC 결제는 아임포트(IMP) 통합 결제로 처리
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
    }
  }
});

// 모바일 결제 완료 처리
app.post('/api/mobile-payment-complete', async (req, res) => {
  const { P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID } = req.body;

  console.log('Mobile payment completion received:', {
    P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID
  });

  const sessionData = paymentSessions.get(P_SESSIONID);
  
  if (!sessionData) {
    console.error('Session not found:', P_SESSIONID);
    return res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=session_not_found`);
  }

  if (P_STATUS === '00') {
    // 결제 성공
    sessionData.status = 'completed';
    sessionData.transactionId = P_TID;
    await notifyMainService(sessionData, 'completed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}`);
  } else {
    // 결제 실패
    sessionData.status = 'failed';
    sessionData.errorMessage = P_RMESG1;
    await notifyMainService(sessionData, 'failed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=${encodeURIComponent(P_RMESG1)}`);
  }
});

// 아임포트 결제 검증 API
app.post('/verify-payment', async (req, res) => {
  const { imp_uid, merchant_uid, success } = req.body;

  console.log('Iamport payment verification received:', {
    imp_uid, merchant_uid, success
  });

  if (!success) {
    return res.json({
      success: false,
      error: '결제 실패',
      redirectUrl: `${MAIN_SERVICE_URL}/coins?payment=error&message=payment_cancelled`
    });
  }

  // merchant_uid에서 sessionId 추출
  const sessionId = extractSessionFromOID(merchant_uid);
  const sessionData = paymentSessions.get(sessionId);

  if (!sessionData) {
    return res.json({
      success: false,
      error: '세션을 찾을 수 없습니다',
      redirectUrl: `${MAIN_SERVICE_URL}/coins?payment=error&message=session_not_found`
    });
  }

  // 결제 성공 처리
  sessionData.status = 'completed';
  sessionData.transactionId = imp_uid;
  await notifyMainService(sessionData, 'completed');

  res.json({
    success: true,
    redirectUrl: `https://www.everyunse.com/coins?payment=success&coins=${sessionData.coins}`
  });
});

// PC 결제 완료 처리 (레거시 KG Inicis)
app.post('/api/pc-payment-complete', async (req, res) => {
  const { P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID } = req.body;

  console.log('PC payment completion received:', {
    P_STATUS, P_RMESG1, P_TID, P_AMT, P_MID, P_OID, P_SESSIONID
  });

  // sessionId가 없으면 P_OID에서 추출
  const sessionId = P_SESSIONID || extractSessionFromOID(P_OID);
  const sessionData = paymentSessions.get(sessionId);
  
  if (!sessionData) {
    console.error('Session not found:', sessionId);
    return res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=session_not_found`);
  }

  if (P_STATUS === '00') {
    // 결제 성공
    sessionData.status = 'completed';
    sessionData.transactionId = P_TID;
    await notifyMainService(sessionData, 'completed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}`);
  } else {
    // 결제 실패
    sessionData.status = 'failed';
    sessionData.errorMessage = P_RMESG1;
    await notifyMainService(sessionData, 'failed');
    
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=${encodeURIComponent(P_RMESG1)}`);
  }
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

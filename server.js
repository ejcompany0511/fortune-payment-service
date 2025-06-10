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

// 아임포트 결제 페이지 (PC/모바일 통합)
app.get('/payment', (req, res) => {
  const { amount, coins, sessionId, merchant_uid, name } = req.query;
  
  console.log('Payment page accessed with params:', { amount, coins, sessionId, merchant_uid, name });
  
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
        .mobile-notice {
            background: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
            color: #1976d2;
            font-size: 14px;
        }
        .debug-info {
            background: #f5f5f5;
            padding: 10px;
            margin-bottom: 20px;
            font-size: 12px;
            color: #666;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="payment-container">
        <div class="logo">🔮 EveryUnse</div>
        
        <div class="debug-info">
            세션ID: ${sessionId}<br>
            주문번호: ${merchant_uid}
        </div>
        
        <div id="mobileNotice" class="mobile-notice" style="display: none;">
            📱 모바일 환경에서 최적화된 결제창이 제공됩니다.
        </div>
        
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
        // 모바일 감지
        const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            document.getElementById('mobileNotice').style.display = 'block';
        }
        
        // 아임포트 초기화 (테스트용 가맹점 식별코드)
        IMP.init('imp57573124'); // 테스트 가맹점 식별코드
        
        function requestPay() {
            const payBtn = document.getElementById('payBtn');
            const loading = document.getElementById('loading');
            
            payBtn.disabled = true;
            loading.style.display = 'block';
            
            console.log('Starting payment with sessionId: ${sessionId}');
            
            IMP.request_pay({
                pg: 'html5_inicis.INIpayTest',
                pay_method: 'card',
                merchant_uid: '${merchant_uid}',
                name: '${name || '코인 패키지'}',
                amount: ${amount},
                buyer_email: 'customer@example.com',
                buyer_name: '고객',
                buyer_tel: '010-0000-0000',
                // 세션ID를 custom_data로 전달
                custom_data: {
                    sessionId: '${sessionId}'
                },
                // 모바일 최적화 옵션
                m_redirect_url: window.location.origin + '/verify-payment-mobile?sessionId=${sessionId}'
            }, function(rsp) {
                console.log('Payment response:', rsp);
                
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
                            sessionId: '${sessionId}',
                            success: false,
                            error_msg: rsp.error_msg
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        alert('결제가 취소되었습니다: ' + (rsp.error_msg || '사용자 취소'));
                        window.location.href = data.redirectUrl;
                    });
                }
            });
        }
    </script>
</body>
</html>`;

  res.send(html);
});

// 결제 요청 생성 (PC/모바일 모두 아임포트 통합)
app.post('/api/create-payment', (req, res) => {
  const { amount, coins, userId, packageId } = req.body;
  
  console.log('Create payment request:', { amount, coins, userId, packageId });
  
  if (!amount || !coins) {
    return res.status(400).json({ error: 'Amount and coins are required' });
  }

  // 세션 ID 생성
  const sessionId = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().toISOString().replace(/[:\-]/g, '').slice(0, 14);
  const orderId = `ORDER_${timestamp}_${sessionId}`;

  console.log('Generated sessionId:', sessionId, 'orderId:', orderId);

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

  // 테스트 환경에서는 시뮬레이션 모드로 전환
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
  }
});

// 아임포트 결제 검증 API
app.post('/verify-payment', async (req, res) => {
  const { imp_uid, merchant_uid, sessionId, success, error_msg } = req.body;

  console.log('Payment verification received:', {
    imp_uid, merchant_uid, sessionId, success, error_msg
  });

  if (!success) {
    return res.json({
      success: false,
      error: error_msg || '결제 실패',
      redirectUrl: `${MAIN_SERVICE_URL}/coins?payment=error&message=payment_cancelled`
    });
  }

  // sessionId를 직접 사용하거나 merchant_uid에서 추출
  let finalSessionId = sessionId;
  if (!finalSessionId && merchant_uid) {
    finalSessionId = extractSessionFromOID(merchant_uid);
  }
  
  console.log('Looking for sessionId:', finalSessionId);
  console.log('Available sessions:', Array.from(paymentSessions.keys()));
  
  const sessionData = paymentSessions.get(finalSessionId);

  if (!sessionData) {
    console.error('Session not found for sessionId:', finalSessionId);
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
    redirectUrl: `${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}`
  });
});

// 모바일 리다이렉트 처리
app.get('/verify-payment-mobile', async (req, res) => {
  const { imp_uid, merchant_uid, imp_success, sessionId } = req.query;
  
  console.log('Mobile verification received:', { imp_uid, merchant_uid, imp_success, sessionId });
  
  if (imp_success === 'true') {
    // 결제 성공
    let finalSessionId = sessionId;
    if (!finalSessionId && merchant_uid) {
      finalSessionId = extractSessionFromOID(merchant_uid);
    }
    
    const sessionData = paymentSessions.get(finalSessionId);
    
    if (sessionData) {
      sessionData.status = 'completed';
      sessionData.transactionId = imp_uid;
      await notifyMainService(sessionData, 'completed');
      
      res.redirect(`${MAIN_SERVICE_URL}/coins?payment=success&coins=${sessionData.coins}`);
    } else {
      res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=session_not_found`);
    }
  } else {
    // 결제 실패
    res.redirect(`${MAIN_SERVICE_URL}/coins?payment=error&message=payment_cancelled`);
  }
});

// OID에서 sessionId 추출 헬퍼 함수
function extractSessionFromOID(oid) {
  if (!oid) return null;
  const parts = oid.split('_');
  // ORDER_timestamp_sessionId 형식에서 sessionId 추출
  return parts.length >= 3 ? parts.slice(2).join('_') : null;
}

// 메인 서비스에 결제 결과 알림
async function notifyMainService(sessionData, status) {
  try {
    console.log('Notifying main service:', sessionData, status);
    
    const webhookUrl = `${MAIN_SERVICE_URL}/api/payment-webhook`;
    const webhookData = {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      status: status,
      transactionId: sessionData.transactionId,
      timestamp: new Date().toISOString()
    };

    // 웹훅 서명 생성
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(webhookData))
      .digest('hex');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      console.error('Failed to notify main service:', response.status, await response.text());
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

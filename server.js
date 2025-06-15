const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소 (간단한 세션 관리용)
const paymentSessions = new Map();

app.use(cors({
  origin: ['https://www.everyunse.com', 'https://everyunse.com', 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev'],
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

// 코인 패키지 정보 가져오기
async function getCoinPackages() {
  try {
    console.log('Fetching coin packages from:', `${MAIN_SERVICE_URL}/api/coin-packages`);
    const response = await axios.get(`${MAIN_SERVICE_URL}/api/coin-packages`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch coin packages:', error.message);
    // 기본 패키지 반환
    return [
      { id: 5, name: "40엽전", coins: 40, bonusCoins: 0, price: 3000 },
      { id: 6, name: "100엽전", coins: 100, bonusCoins: 0, price: 7500 }
    ];
  }
}

// 메인 엽전 상점 페이지
app.get('/', async (req, res) => {
  try {
    const packages = await getCoinPackages();
    const { sessionId, userId, packageId, amount, coins, bonusCoins, returnUrl } = req.query;
    
    console.log('Received URL parameters:', { sessionId, userId, packageId, amount, coins, bonusCoins, returnUrl });
    
    // URL 파라미터로 받은 데이터를 세션에 저장
    let sessionData = null;
    if (sessionId && userId) {
      console.log('Missing required URL parameters (sessionId, userId):', { sessionId, userId, packageId, amount, coins });
      
      // packageId가 없는 경우 - 패키지 선택을 외부에서 하는 경우
      if (!packageId) {
        console.log('Creating session for package selection in external service');
        sessionData = {
          userId: userId,
          packageId: null, // 나중에 패키지 선택 시 업데이트
          returnUrl: returnUrl,
          timestamp: Date.now()
        };
      } else {
        // packageId가 있는 경우 - 기존 로직
        console.log('Creating session with specific package selection');
        sessionData = {
          userId: userId,
          packageId: parseInt(packageId),
          amount: parseFloat(amount),
          coins: parseInt(coins),
          bonusCoins: parseInt(bonusCoins) || 0,
          returnUrl: returnUrl,
          timestamp: Date.now()
        };
      }
      
      paymentSessions.set(sessionId, sessionData);
      console.log('Created session data from URL params:', sessionData);
    } else {
      console.log('No sessionId or userId provided, loading coin shop without session');
    }
    
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>엽전 충전 - EveryUnse</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 10px;
            font-size: 2.5em;
            font-weight: bold;
        }

        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 40px;
            font-size: 1.1em;
        }

        .packages-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .package-card {
            border: 2px solid #f0f0f0;
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            transition: all 0.3s ease;
            background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }

        .package-card:hover {
            border-color: #667eea;
            transform: translateY(-5px);
            box-shadow: 0 15px 30px rgba(102, 126, 234, 0.2);
        }

        .package-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.1), transparent);
            transition: left 0.5s;
        }

        .package-card:hover::before {
            left: 100%;
        }

        .coins-amount {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .price {
            font-size: 1.8em;
            color: #333;
            margin-bottom: 20px;
            font-weight: 600;
        }

        .bonus {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            margin-bottom: 20px;
            display: inline-block;
            font-weight: bold;
        }

        .select-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 40px;
            border-radius: 50px;
            font-size: 1.1em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
            margin-top: 10px;
        }

        .select-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        .popular {
            border-color: #f093fb !important;
            background: linear-gradient(135deg, #fff5f8 0%, #fff 100%);
        }

        .popular .coins-amount {
            color: #f093fb;
        }

        .popular::after {
            content: '인기';
            position: absolute;
            top: 15px;
            right: 15px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .coin-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            color: white;
            font-weight: bold;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            display: none;
            z-index: 1000;
            font-weight: bold;
        }

        .notification.success {
            background: #4CAF50;
        }

        .notification.error {
            background: #f44336;
        }

        @media (max-width: 768px) {
            .container {
                padding: 20px;
                margin: 10px;
            }
            
            h1 {
                font-size: 2em;
            }
            
            .packages-grid {
                grid-template-columns: 1fr;
            }
            
            .package-card {
                padding: 20px;
            }
        }
    </style>
    <script src="https://cdn.iamport.kr/v1/iamport.js"></script>
</head>
<body>
    <div class="container">
        <h1>엽전 충전</h1>
        <p class="subtitle">원하는 패키지를 선택하고 충전하세요</p>
        
        <div class="packages-grid" id="packages-container">
            <!-- 패키지들이 여기에 동적으로 추가됩니다 -->
        </div>
    </div>

    <div class="notification" id="notification"></div>

    <script>
        const IMP = window.IMP;
        IMP.init('imp68124036'); // 아임포트 가맹점 식별코드
        
        const sessionId = new URLSearchParams(window.location.search).get('sessionId');
        const userId = new URLSearchParams(window.location.search).get('userId');
        
        console.log('Session info:', { sessionId, userId });

        function showNotification(message, type = 'success') {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = \`notification \${type}\`;
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }

        function getReturnUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('returnUrl') || 'https://www.everyunse.com';
        }

        async function selectPackage(packageData) {
            if (!sessionId || !userId) {
                showNotification('세션 정보가 없습니다. 다시 시도해주세요.', 'error');
                return;
            }

            try {
                // 세션 데이터 업데이트
                const updateResponse = await fetch('/api/update-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        packageId: packageData.id,
                        amount: packageData.price,
                        coins: packageData.coins
                    })
                });

                if (!updateResponse.ok) {
                    throw new Error('세션 업데이트 실패');
                }

                console.log('Session updated, starting payment...');
                
                // 아임포트 결제 시작
                const merchant_uid = \`oid_\${sessionId}_\${Date.now()}\`;
                
                IMP.request_pay({
                    pg: 'kakaopay.TC0ONETIME',
                    pay_method: 'card',
                    merchant_uid: merchant_uid,
                    name: packageData.name,
                    amount: packageData.price,
                    buyer_name: '고객',
                    buyer_email: 'customer@example.com'
                }, function(rsp) {
                    console.log('Payment response:', rsp);
                    
                    if (rsp.success) {
                        // 결제 검증 요청
                        fetch('/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imp_uid: rsp.imp_uid,
                                merchant_uid: rsp.merchant_uid,
                                sessionId: sessionId,
                                success: true
                            })
                        })
                        .then(response => response.json())
                        .then(data => {
                            console.log('Verification response:', data);
                            if (data.success) {
                                showNotification('결제가 완료되었습니다!');
                                setTimeout(() => {
                                    const returnUrl = getReturnUrl();
                                    window.location.href = returnUrl;
                                }, 1500);
                            } else {
                                showNotification('결제 검증 실패');
                            }
                        })
                        .catch(error => {
                            console.error('Verification error:', error);
                            showNotification('결제 검증 중 오류 발생');
                        });
                    } else {
                        showNotification('결제 실패: ' + rsp.error_msg);
                    }
                });
                
            } catch (error) {
                console.error('Payment error:', error);
                showNotification('결제 처리 중 오류가 발생했습니다.', 'error');
            }
        }

        async function renderPackages() {
            try {
                const packages = ${JSON.stringify(packages)};
                const container = document.getElementById('packages-container');
                
                packages.forEach((pkg, index) => {
                    const isPopular = index === 1; // 두 번째 패키지를 인기 항목으로
                    const bonusText = pkg.bonusCoins > 0 ? \`+\${pkg.bonusCoins} 보너스\` : '';
                    
                    const packageElement = document.createElement('div');
                    packageElement.className = \`package-card \${isPopular ? 'popular' : ''}\`;
                    packageElement.innerHTML = \`
                        <div class="coins-amount">
                            <div class="coin-icon">엽</div>
                            \${pkg.coins.toLocaleString()}
                        </div>
                        <div class="price">\${pkg.price.toLocaleString()}원</div>
                        \${bonusText ? \`<div class="bonus">\${bonusText}</div>\` : ''}
                        <button class="select-btn" onclick="selectPackage({\${pkg.id}, '\${pkg.name}', \${pkg.coins}, \${pkg.bonusCoins || 0}, \${pkg.price}})">
                            선택하기
                        </button>
                    \`;
                    
                    packageElement.onclick = () => selectPackage({
                        id: pkg.id,
                        name: pkg.name,
                        coins: pkg.coins,
                        bonusCoins: pkg.bonusCoins || 0,
                        price: pkg.price
                    });
                    
                    container.appendChild(packageElement);
                });
                
            } catch (error) {
                console.error('Error rendering packages:', error);
                showNotification('패키지 로딩 중 오류가 발생했습니다.', 'error');
            }
        }

        document.addEventListener('DOMContentLoaded', renderPackages);
    </script>
</body>
</html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error loading coin shop:', error);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 세션 데이터 업데이트 엔드포인트
app.post('/api/update-session', (req, res) => {
  try {
    const { sessionId, packageId, amount, coins } = req.body;
    console.log('Updating session data:', { sessionId, packageId, amount, coins });
    
    const sessionData = paymentSessions.get(sessionId);
    if (sessionData) {
      sessionData.packageId = packageId;
      sessionData.amount = amount;
      sessionData.coins = coins;
      paymentSessions.set(sessionId, sessionData);
      console.log('Session updated successfully:', sessionData);
      res.json({ success: true });
    } else {
      console.log('Session not found for ID:', sessionId);
      res.status(404).json({ success: false, error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// sessionId에서 추출하는 함수
function extractSessionFromOID(oid) {
  // oid_sessionId_timestamp 형태에서 sessionId 추출
  const parts = oid.split('_');
  if (parts.length >= 3) {
    // 첫 번째 'oid'를 제거하고 마지막 timestamp를 제거
    return parts.slice(1, -1).join('_');
  }
  return null;
}

// 메인 서비스에 결제 완료 알림
async function notifyMainService(sessionData, status) {
  try {
    const webhookUrl = `${MAIN_SERVICE_URL}/api/payment/webhook`;
    console.log('Sending webhook to:', webhookUrl);
    console.log('Session data for webhook:', sessionData);
    
    const response = await axios.post(webhookUrl, {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      status: status,
      timestamp: Date.now()
    }, {
      headers: {
        'Authorization': `Bearer ${WEBHOOK_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Webhook response:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to notify main service:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.status, error.response.data);
    }
    throw error;
  }
}

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
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=payment_cancelled`
    });
  }

  // sessionId를 직접 사용하거나 merchant_uid에서 추출
  let finalSessionId = sessionId;
  if (!finalSessionId && merchant_uid) {
    finalSessionId = extractSessionFromOID(merchant_uid);
  }
  
  console.log('Looking for sessionId:', finalSessionId);
  console.log('Available sessions:', Array.from(paymentSessions.keys()));

  if (!finalSessionId) {
    console.error('No sessionId available');
    return res.json({
      success: false,
      error: 'Session ID not found',
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=session_not_found`
    });
  }

  const sessionData = paymentSessions.get(finalSessionId);
  if (!sessionData) {
    console.error('Session not found for ID:', finalSessionId);
    return res.json({
      success: false,
      error: 'Session not found',
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=session_not_found`
    });
  }

  console.log('Found session data:', sessionData);

  try {
    // 메인 서비스에 결제 완료 알림
    const webhookData = {
      ...sessionData,
      sessionId: finalSessionId,
      transactionId: imp_uid,
      merchantUid: merchant_uid
    };
    
    await notifyMainService(webhookData, 'success');
    
    // 세션 정리
    paymentSessions.delete(finalSessionId);
    
    // 성공 응답과 함께 리다이렉트 URL 제공
    const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
    res.json({
      success: true,
      message: '결제가 성공적으로 완료되었습니다',
      redirectUrl: `${returnUrl}?payment=success&coins=${sessionData.coins}`
    });
    
  } catch (error) {
    console.error('Error processing payment completion:', error);
    res.json({
      success: false,
      error: '결제 처리 중 오류가 발생했습니다',
      redirectUrl: `${MAIN_SERVICE_URL}?payment=error&message=processing_failed`
    });
  }
});

// KG Inicis 결제 결과 처리
app.post('/inicis/return', async (req, res) => {
  console.log('KG Inicis return received:', req.body);
  
  const { P_STATUS, P_RMESG1, P_TID, P_OID } = req.body;
  
  // P_OID에서 sessionId 추출
  const sessionId = extractSessionFromOID(P_OID);
  
  if (!sessionId) {
    console.error('Cannot extract sessionId from P_OID:', P_OID);
    return res.redirect(`${MAIN_SERVICE_URL}?payment=error&message=invalid_order_id`);
  }
  
  const sessionData = paymentSessions.get(sessionId);
  if (!sessionData) {
    console.error('Session not found for extracted sessionId:', sessionId);
    return res.redirect(`${MAIN_SERVICE_URL}?payment=error&message=session_not_found`);
  }

  try {
    if (P_STATUS === '00') {
      // 결제 성공
      console.log('KG Inicis payment successful:', { P_TID, P_OID, sessionId });
      
      const webhookData = {
        ...sessionData,
        sessionId: sessionId,
        transactionId: P_TID,
        merchantUid: P_OID
      };
      
      await notifyMainService(webhookData, 'success');
      
      // 세션 정리
      paymentSessions.delete(sessionId);
      
      const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
      res.redirect(`${returnUrl}?payment=success&coins=${sessionData.coins}`);
      
    } else {
      // 결제 실패
      console.log('KG Inicis payment failed:', { P_STATUS, P_RMESG1, P_OID });
      
      const webhookData = {
        ...sessionData,
        sessionId: sessionId,
        error: P_RMESG1
      };
      
      await notifyMainService(webhookData, 'failed');
      
      // 세션 정리
      paymentSessions.delete(sessionId);
      
      const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
      res.redirect(`${returnUrl}?payment=error&message=${encodeURIComponent(P_RMESG1)}`);
    }
    
  } catch (error) {
    console.error('Error processing KG Inicis return:', error);
    const returnUrl = sessionData.returnUrl || `${MAIN_SERVICE_URL}`;
    res.redirect(`${returnUrl}?payment=error&message=processing_failed`);
  }
});

app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log('Environment:', {
    INICIS_MID,
    MAIN_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV
  });
});

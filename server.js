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

// Iamport 설정
const IAMPORT_IMP_CODE = 'imp55863830';
const IAMPORT_REST_API_KEY = '6827720077710430';
const IAMPORT_REST_API_SECRET = 'gOWFNtSN9uEcBZwJI5EI6Ke9AYMu3HLmJSy3nVbqzYW4aQUlTUbgBjfKmqFGSfWvJ8Yc3dwf1A9G2RjT';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
const WEBHOOK_SECRET = 'EveryUnse2024PaymentSecureWebhook!@#';

// 코인 패키지 정보 가져오기
async function getCoinPackages() {
  try {
    const response = await axios.get(MAIN_SERVICE_URL + '/api/coin-packages');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch coin packages:', error.message);
    return [
      { id: 5, name: "40엽전", coins: 40, bonusCoins: 0, price: 3000 },
      { id: 6, name: "100엽전", coins: 100, bonusCoins: 0, price: 7500 }
    ];
  }
}

// 세션 ID에서 추출하는 함수
function extractSessionFromOID(oid) {
  const parts = oid.split('_');
  if (parts.length >= 2) {
    return parts[1];
  }
  return null;
}

// 메인 서비스에 결제 결과 알림
async function notifyMainService(sessionData, status) {
  try {
    const response = await axios.post(MAIN_SERVICE_URL + '/api/payment/webhook', {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      bonusCoins: sessionData.bonusCoins,
      status: status,
      timestamp: Date.now()
    }, {
      headers: {
        'Authorization': 'Bearer ' + WEBHOOK_SECRET,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Main service notification sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to notify main service:', error.message);
    throw error;
  }
}

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 메인 엽전 상점 페이지 (Iamport JavaScript SDK 사용)
app.get('/', async (req, res) => {
  try {
    const packages = await getCoinPackages();
    const { userId, sessionId, returnTo } = req.query;
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>엽전 상점 - EveryUnse</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: #333; }
        .container { max-width: 480px; margin: 0 auto; background: white; min-height: 100vh; position: relative; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; position: sticky; top: 0; z-index: 100; }
        .header-content { display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .back-btn { background: none; border: none; color: white; padding: 8px; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
        .back-btn:hover { background: rgba(255, 255, 255, 0.1); }
        .header-title { font-size: 18px; font-weight: 600; }
        .coin-balance { background: rgba(255, 255, 255, 0.2); padding: 8px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
        .hero-section { padding: 24px 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; }
        .hero-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(20px); border-radius: 20px; padding: 32px 24px; border: 1px solid rgba(255, 255, 255, 0.2); position: relative; overflow: hidden; }
        .hero-icon { font-size: 48px; margin-bottom: 16px; }
        .hero-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .hero-subtitle { font-size: 16px; opacity: 0.9; line-height: 1.5; }
        .packages-section { padding: 32px 20px; }
        .packages-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #1f2937; }
        .packages-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
        .package-card { background: white; border-radius: 16px; padding: 20px; text-align: center; border: 2px solid #e5e7eb; transition: all 0.3s ease; cursor: pointer; position: relative; overflow: hidden; }
        .package-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); border-color: #8b5cf6; }
        .package-card.popular { border-color: #f59e0b; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); }
        .package-card.popular::before { content: "인기"; position: absolute; top: 8px; right: 8px; background: #f59e0b; color: white; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
        .package-icon { font-size: 32px; margin-bottom: 12px; }
        .package-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1f2937; }
        .package-price { font-size: 16px; color: #6b7280; margin-bottom: 16px; }
        .package-btn { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%; transition: all 0.3s ease; }
        .package-btn:hover { transform: scale(1.05); box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3); }
        .notification { position: fixed; top: 20px; right: 20px; background: #1f2937; color: white; padding: 16px 24px; border-radius: 12px; display: none; z-index: 1000; font-weight: 600; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); }
        .notification.success { background: #10b981; }
        .notification.error { background: #ef4444; }
        @media (max-width: 640px) { .container { margin: 0; padding-bottom: 60px; } }
    </style>
    <script src="https://cdn.iamport.kr/v1/iamport.js"></script>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="header-content">
                <div class="header-left">
                    <button class="back-btn" onclick="goBack()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="m15 18-6-6 6-6"/>
                        </svg>
                    </button>
                    <h1 class="header-title">엽전 상점</h1>
                </div>
                <div class="coin-balance">💰 잔액</div>
            </div>
        </header>

        <section class="hero-section">
            <div class="hero-card">
                <div class="hero-icon">💰</div>
                <h2 class="hero-title">엽전 충전하기</h2>
                <p class="hero-subtitle">더 많은 운세를 확인하려면 엽전이 필요해요</p>
            </div>
        </section>

        <section class="packages-section">
            <h3 class="packages-title">엽전 패키지</h3>
            <div class="packages-grid" id="packages-container"></div>
        </section>
    </div>

    <div id="notification" class="notification"></div>

    <script>
        const IMP = window.IMP;
        IMP.init('` + IAMPORT_IMP_CODE + `');
        
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId') || localStorage.getItem('userId');
        const sessionId = urlParams.get('sessionId') || Date.now().toString();
        const returnTo = urlParams.get('returnTo') || 'home';
        
        if (userId) localStorage.setItem('userId', userId);
        localStorage.setItem('sessionId', sessionId);
        localStorage.setItem('returnTo', returnTo);

        function getReturnUrl() {
            const returnTo = localStorage.getItem('returnTo') || 'home';
            const hostname = window.location.hostname;
            let baseUrl = 'https://www.everyunse.com';
            
            if (hostname.includes('replit.dev')) {
                baseUrl = 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
            }
            
            const urlMap = {
                'home': baseUrl + '/',
                'profile': baseUrl + '/profile',
                'transactions': baseUrl + '/transactions',
                'coins': baseUrl + '/coins'
            };
            
            return urlMap[returnTo] || baseUrl + '/';
        }

        function goBack() {
            window.location.href = getReturnUrl();
        }

        function showNotification(message, type) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = 'notification ' + (type || 'success');
            notification.style.display = 'block';
            setTimeout(function() { notification.style.display = 'none'; }, 3000);
        }

        async function handlePayment(packageData) {
            try {
                if (!userId) {
                    showNotification('로그인이 필요합니다.', 'error');
                    setTimeout(function() { window.location.href = 'https://www.everyunse.com/auth'; }, 1500);
                    return;
                }

                const updateResponse = await fetch('/api/update-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionId,
                        userId: userId,
                        packageId: packageData.id,
                        amount: packageData.price,
                        coins: packageData.coins,
                        bonusCoins: packageData.bonusCoins || 0
                    })
                });

                const updateResult = await updateResponse.json();
                if (!updateResult.success) {
                    showNotification('세션 업데이트에 실패했습니다.', 'error');
                    return;
                }

                const merchantUid = 'EveryUnse_' + sessionId + '_' + Date.now();
                
                IMP.request_pay({
                    pg: 'html5_inicis',
                    pay_method: 'card',
                    merchant_uid: merchantUid,
                    name: packageData.name + ' 엽전 충전',
                    amount: packageData.price,
                    buyer_email: 'test@test.com',
                    buyer_name: '엽전충전',
                    buyer_tel: '010-0000-0000',
                    custom_data: {
                        sessionId: sessionId,
                        userId: userId,
                        packageId: packageData.id,
                        coins: packageData.coins,
                        bonusCoins: packageData.bonusCoins || 0
                    }
                }, async function(rsp) {
                    if (rsp.success) {
                        try {
                            const response = await fetch('/webhook', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    imp_uid: rsp.imp_uid,
                                    merchant_uid: rsp.merchant_uid,
                                    status: 'paid',
                                    custom_data: rsp.custom_data || {
                                        sessionId: sessionId,
                                        userId: userId,
                                        packageId: packageData.id,
                                        coins: packageData.coins,
                                        bonusCoins: packageData.bonusCoins || 0
                                    }
                                })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                showNotification('결제가 완료되었습니다!');
                                setTimeout(function() {
                                    window.location.href = getReturnUrl();
                                }, 2000);
                            } else {
                                showNotification('결제 처리 중 오류가 발생했습니다.', 'error');
                            }
                        } catch (error) {
                            console.error('Webhook error:', error);
                            showNotification('결제 확인 중 오류가 발생했습니다.', 'error');
                        }
                    } else {
                        console.log('Payment failed:', rsp.error_msg);
                        showNotification('결제가 실패했습니다: ' + rsp.error_msg, 'error');
                    }
                });
                
            } catch (error) {
                console.error('Payment error:', error);
                showNotification('결제 처리 중 오류가 발생했습니다.', 'error');
            }
        }

        function renderPackages() {
            const packages = ` + JSON.stringify(packages) + `;
            const container = document.getElementById('packages-container');
            
            if (!packages || packages.length === 0) {
                container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #6b7280;">패키지 정보를 불러올 수 없습니다.</div>';
                return;
            }
            
            container.innerHTML = packages.map(function(pkg, index) {
                return '<div class="package-card ' + (index === 1 ? 'popular' : '') + '" onclick="handlePayment(' + JSON.stringify(pkg).replace(/"/g, '&quot;') + ')">' +
                    '<div class="package-icon">💰</div>' +
                    '<div class="package-name">' + pkg.name + '</div>' +
                    '<div class="package-price">₩' + parseFloat(pkg.price).toLocaleString() + '</div>' +
                    '<button class="package-btn">구매하기</button>' +
                '</div>';
            }).join('');
        }

        document.addEventListener('DOMContentLoaded', renderPackages);
    </script>
</body>
</html>
    `;
    
    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving payment page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 세션 업데이트 엔드포인트
app.post('/api/update-session', (req, res) => {
  try {
    const { sessionId, userId, packageId, amount, coins, bonusCoins } = req.body;
    
    if (!sessionId || !userId || !packageId || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    
    paymentSessions.set(sessionId, {
      sessionId: sessionId,
      userId: userId,
      packageId: packageId,
      amount: amount,
      coins: coins,
      bonusCoins: bonusCoins || 0,
      timestamp: Date.now()
    });
    
    console.log('Session updated successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 웹훅 엔드포인트 (결제 완료 처리)
app.post('/webhook', async (req, res) => {
  try {
    const { imp_uid, merchant_uid, status, custom_data } = req.body;
    console.log('Received webhook:', { imp_uid, merchant_uid, status, custom_data });
    
    const sessionId = custom_data?.sessionId || extractSessionFromOID(merchant_uid);
    if (!sessionId) {
      console.error('No sessionId in custom_data or merchant_uid');
      return res.status(400).json({ success: false, error: 'No session ID' });
    }
    
    const sessionData = paymentSessions.get(sessionId);
    if (!sessionData) {
      console.error('Session not found:', sessionId);
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    if (status === 'paid') {
      try {
        await notifyMainService(sessionData, 'completed');
        paymentSessions.delete(sessionId);
        res.json({ success: true, message: 'Payment processed successfully' });
      } catch (error) {
        console.error('Failed to process payment:', error);
        res.status(500).json({ success: false, error: 'Failed to process payment' });
      }
    } else {
      res.json({ success: false, error: 'Payment not completed' });
    }
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.listen(PORT, function() {
  console.log('Payment service running on port ' + PORT);
});

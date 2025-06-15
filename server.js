const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소
const paymentSessions = new Map();

app.use(cors({
  origin: ['https://www.everyunse.com', 'https://everyunse.com', 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev'],
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 설정
const IAMPORT_IMP_CODE = 'imp55863830';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
const WEBHOOK_SECRET = 'EveryUnse2024PaymentSecureWebhook!@#';

function getReturnUrl() {
  const hostname = process.env.NODE_ENV === 'production' ? 'www.everyunse.com' : '4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
  return 'https://' + hostname + '/';
}

async function getCoinPackages() {
  try {
    console.log('Fetching coin packages from:', MAIN_SERVICE_URL + '/api/coin-packages');
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

function extractSessionFromOID(oid) {
  const parts = oid.split('_');
  if (parts.length >= 3) {
    return parts[0] + '_' + parts[1] + '_' + parts[2];
  }
  return oid;
}

async function notifyMainService(sessionData, status) {
  try {
    const webhook_url = MAIN_SERVICE_URL + '/api/payment/webhook';
    console.log('Sending webhook to:', webhook_url);
    console.log('Webhook data:', sessionData);
    
    const response = await axios.post(webhook_url, {
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
      },
      timeout: 10000
    });
    
    console.log('Webhook response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Webhook notification failed:', error.message);
    throw error;
  }
}

// 메인 결제 페이지
app.get('/', async (req, res) => {
  try {
    const { sessionId, userId, returnUrl } = req.query;
    
    if (!sessionId || !userId) {
      return res.status(400).send('Missing session or user ID');
    }

    const packages = await getCoinPackages();
    console.log('Serving payment page for session:', sessionId, 'user:', userId);
    console.log('Available packages:', packages);

    res.send(\`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>엽전 상점 - EveryUnse</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            background: #f9fafb; 
            min-height: 100vh; 
            color: #333; 
        }
        .container { 
            max-width: 448px; 
            margin: 0 auto; 
            background: #f9fafb; 
            min-height: 100vh; 
            position: relative; 
            padding-bottom: 80px; 
        }
        
        /* Header */
        .header { 
            position: sticky; 
            top: 0; 
            z-index: 50; 
            background: white; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); 
            border-bottom: 1px solid #e5e7eb; 
        }
        .header-content { 
            padding: 12px 16px; 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
        }
        .header-left { 
            display: flex; 
            align-items: center; 
            gap: 12px; 
        }
        .back-btn { 
            background: none; 
            border: none; 
            color: #6b7280; 
            padding: 8px; 
            border-radius: 6px; 
            cursor: pointer; 
            transition: background 0.2s; 
        }
        .back-btn:hover { background: #f3f4f6; }
        .header-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
        }
        .coin-balance { 
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
            color: white; 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-size: 14px; 
            font-weight: 600; 
            display: flex; 
            align-items: center; 
            gap: 6px; 
        }
        
        /* Hero Section */
        .hero-section { padding: 16px; }
        .hero-card { 
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
            color: white; 
            padding: 24px; 
            border-radius: 16px; 
            text-align: center; 
            position: relative; 
            overflow: hidden; 
        }
        .hero-icon-container { 
            width: 64px; 
            height: 64px; 
            background: rgba(255, 255, 255, 0.2); 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin: 0 auto 16px; 
        }
        .hero-icon { font-size: 32px; }
        .hero-title { 
            font-size: 20px; 
            font-weight: 700; 
            margin-bottom: 8px; 
        }
        .hero-subtitle { 
            font-size: 14px; 
            opacity: 0.9; 
        }
        .hero-decoration { 
            position: absolute; 
            top: -16px; 
            right: -16px; 
            font-size: 96px; 
            opacity: 0.2; 
        }
        
        /* Packages Section */
        .packages-section { padding: 16px; }
        .packages-title { 
            font-size: 18px; 
            font-weight: 700; 
            margin-bottom: 16px; 
            color: #111827; 
        }
        .packages-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 12px; 
            margin-bottom: 24px; 
        }
        
        /* Package Cards */
        .package-card { 
            background: white; 
            border-radius: 16px; 
            padding: 16px; 
            text-align: center; 
            border: 1px solid #e5e7eb; 
            transition: all 0.3s ease; 
            cursor: pointer; 
            position: relative; 
            overflow: hidden; 
        }
        .package-card:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1); 
        }
        .package-card.popular { 
            border: 2px solid #7c3aed; 
        }
        .package-popular-badge { 
            position: absolute; 
            top: -8px; 
            left: 50%; 
            transform: translateX(-50%); 
            background: #7c3aed; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 10px; 
            font-weight: 600; 
            z-index: 10; 
        }
        
        .package-icon-container { 
            width: 48px; 
            height: 48px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin: 0 auto 12px; 
        }
        .korean-gradient-blue { 
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
        }
        .korean-gradient-purple { 
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
        }
        .korean-gradient-gold { 
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
        }
        .korean-gradient-rose { 
            background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); 
        }
        
        .package-icon { 
            font-size: 24px; 
            color: white; 
        }
        .package-name { 
            font-weight: 700; 
            color: #111827; 
            margin-bottom: 4px; 
        }
        .package-coins { 
            font-size: 24px; 
            font-weight: 700; 
            color: #7c3aed; 
            margin-bottom: 4px; 
        }
        .package-coins-label { 
            font-size: 12px; 
            color: #6b7280; 
            margin-bottom: 12px; 
        }
        .package-bonus { 
            font-size: 12px; 
            color: #059669; 
            font-weight: 500; 
            margin-bottom: 12px; 
        }
        .package-price { 
            font-size: 18px; 
            font-weight: 700; 
            color: #111827; 
            margin-bottom: 12px; 
        }
        .package-btn { 
            background: white; 
            color: #7c3aed; 
            border: 2px solid #7c3aed; 
            padding: 8px 16px; 
            border-radius: 12px; 
            font-weight: 600; 
            cursor: pointer; 
            width: 100%; 
            transition: all 0.3s ease; 
        }
        .package-btn:hover { 
            background: #7c3aed; 
            color: white; 
        }
        .package-card.popular .package-btn { 
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
            color: white; 
            border: none; 
        }
        
        /* Payment Info */
        .payment-info { padding: 0 16px 24px; }
        .payment-card { 
            background: white; 
            border-radius: 16px; 
            padding: 24px; 
            border: 1px solid #e5e7eb; 
            margin-bottom: 24px; 
        }
        .payment-header { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            margin-bottom: 16px; 
        }
        .payment-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
        }
        .payment-subtitle { 
            font-weight: 500; 
            margin-bottom: 12px; 
            color: #374151; 
        }
        .payment-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 8px; 
        }
        .payment-item { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            padding: 8px 0; 
            font-size: 14px; 
            color: #6b7280; 
        }
        .check-icon { 
            color: #10b981; 
            font-weight: 600; 
        }
        
        .secure-section { margin-top: 16px; }
        .secure-list { margin-top: 12px; }
        .secure-item { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            padding: 8px 0; 
            font-size: 14px; 
            color: #6b7280; 
        }
        
        .notice-box { 
            padding: 12px; 
            background: #dbeafe; 
            border-radius: 12px; 
            margin-top: 16px; 
        }
        .notice-text { 
            font-size: 12px; 
            color: #1e40af; 
        }
        
        /* FAQ */
        .faq-card { 
            background: white; 
            border-radius: 16px; 
            padding: 24px; 
            border: 1px solid #e5e7eb; 
        }
        .faq-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
            margin-bottom: 16px; 
        }
        .faq-item { margin-bottom: 16px; }
        .faq-question { 
            font-weight: 500; 
            margin-bottom: 8px; 
            color: #374151; 
        }
        .faq-answer { 
            font-size: 14px; 
            color: #6b7280; 
            line-height: 1.5; 
        }
        
        .notification { 
            position: fixed; 
            top: 20px; 
            left: 50%; 
            transform: translateX(-50%); 
            background: #1f2937; 
            color: white; 
            padding: 16px 24px; 
            border-radius: 12px; 
            display: none; 
            z-index: 1000; 
            font-weight: 600; 
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); 
        }
        .notification.success { background: #10b981; }
        .notification.error { background: #ef4444; }
        
        @media (max-width: 640px) { 
            .container { margin: 0; } 
            .packages-grid { gap: 8px; }
            .package-card { padding: 12px; }
        }
    </style>
    <script src="https://cdn.iamport.kr/v1/iamport.js"></script>
</head>
<body>
    <div class="container">
        <!-- Header -->
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
                <div class="coin-balance">
                    💰 잔액
                </div>
            </div>
        </header>

        <!-- Hero Section -->
        <section class="hero-section">
            <div class="hero-card">
                <div class="hero-icon-container">
                    <div class="hero-icon">💰</div>
                </div>
                <h2 class="hero-title">엽전 충전하기</h2>
                <p class="hero-subtitle">더 많은 운세를 확인하려면 엽전이 필요해요</p>
                <div class="hero-decoration">💰</div>
            </div>
        </section>

        <!-- Coin Packages -->
        <section class="packages-section">
            <h3 class="packages-title">엽전 패키지</h3>
            <div class="packages-grid" id="packages-container">
                <!-- 패키지가 여기에 렌더링됩니다 -->
            </div>
        </section>

        <!-- Payment Info -->
        <section class="payment-info">
            <div class="payment-card">
                <div class="payment-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    <h4 class="payment-title">결제 정보</h4>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <h4 class="payment-subtitle">지원 결제 수단</h4>
                        <div class="payment-grid">
                            <div class="payment-item">
                                <span class="check-icon">✓</span>
                                <span>신용카드</span>
                            </div>
                            <div class="payment-item">
                                <span class="check-icon">✓</span>
                                <span>체크카드</span>
                            </div>
                            <div class="payment-item">
                                <span class="check-icon">✓</span>
                                <span>계좌이체</span>
                            </div>
                            <div class="payment-item">
                                <span class="check-icon">✓</span>
                                <span>카카오페이</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="secure-section">
                        <h4 class="payment-subtitle">안전한 결제</h4>
                        <div class="secure-list">
                            <div class="secure-item">
                                <span class="check-icon">✓</span>
                                <span>SSL 암호화 보안</span>
                            </div>
                            <div class="secure-item">
                                <span class="check-icon">✓</span>
                                <span>카드정보 미저장</span>
                            </div>
                            <div class="secure-item">
                                <span class="check-icon">✓</span>
                                <span>PG사 안전결제</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="notice-box">
                        <p class="notice-text">
                            결제 완료 후 즉시 엽전이 충전됩니다. 
                            문제가 발생하면 고객센터로 문의해주세요.
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- FAQ -->
            <div class="faq-card">
                <h4 class="faq-title">자주 묻는 질문</h4>
                
                <div class="faq-item">
                    <h5 class="faq-question">Q. 결제 후 엽전이 언제 충전되나요?</h5>
                    <p class="faq-answer">결제 완료 즉시 자동으로 충전됩니다.</p>
                </div>
                
                <div class="faq-item">
                    <h5 class="faq-question">Q. 환불이 가능한가요?</h5>
                    <p class="faq-answer">엽전 사용 전이라면 환불 신청이 가능합니다.</p>
                </div>
                
                <div class="faq-item">
                    <h5 class="faq-question">Q. 결제 오류가 발생했어요</h5>
                    <p class="faq-answer">브라우저를 새로고침하거나 고객센터로 문의해주세요.</p>
                </div>
            </div>
        </section>
    </div>

    <div class="notification" id="notification"></div>

    <script>
        var IMP = window.IMP;
        IMP.init('\${IAMPORT_IMP_CODE}');
        
        var sessionId = '\${sessionId}';
        var userId = '\${userId}';
        var returnUrl = '\${returnUrl || getReturnUrl()}';

        function goBack() {
            if (returnUrl) {
                window.location.href = returnUrl;
            } else {
                window.history.back();
            }
        }

        function showNotification(message, type) {
            var notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = 'notification ' + (type || 'success');
            notification.style.display = 'block';
            
            setTimeout(function() {
                notification.style.display = 'none';
            }, 3000);
        }

        function handlePayment(packageData) {
            console.log('Starting payment for package:', packageData);
            
            var merchantUid = 'payment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
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
            }, function(rsp) {
                if (rsp.success) {
                    console.log('Payment success:', rsp);
                    handlePaymentSuccess(rsp, packageData);
                } else {
                    console.log('Payment failed:', rsp.error_msg);
                    showNotification('결제가 실패했습니다: ' + rsp.error_msg, 'error');
                }
            });
        }

        function handlePaymentSuccess(rsp, packageData) {
            fetch('/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imp_uid: rsp.imp_uid,
                    merchant_uid: rsp.merchant_uid,
                    status: 'paid',
                    sessionId: sessionId,
                    userId: userId,
                    packageId: packageData.id,
                    coins: packageData.coins,
                    bonusCoins: packageData.bonusCoins || 0,
                    amount: packageData.price
                })
            })
            .then(function(response) { return response.json(); })
            .then(function(result) {
                if (result.success) {
                    showNotification('결제가 완료되었습니다!');
                    setTimeout(function() {
                        window.location.href = returnUrl;
                    }, 2000);
                } else {
                    showNotification('결제 처리 중 오류가 발생했습니다.', 'error');
                }
            })
            .catch(function(error) {
                console.error('Webhook error:', error);
                showNotification('결제 확인 중 오류가 발생했습니다.', 'error');
            });
        }

        function renderPackages() {
            var packages = \${JSON.stringify(packages)};
            var container = document.getElementById('packages-container');
            
            if (!packages || packages.length === 0) {
                container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #6b7280;">패키지 정보를 불러올 수 없습니다.</div>';
                return;
            }
            
            var gradients = ['korean-gradient-blue', 'korean-gradient-purple', 'korean-gradient-gold', 'korean-gradient-rose'];
            
            var html = '';
            for (var i = 0; i < packages.length; i++) {
                var pkg = packages[i];
                var gradient = gradients[i % gradients.length];
                var isPopular = pkg.isPopular || i === 1;
                
                html += '<div class="package-card ' + (isPopular ? 'popular' : '') + '" onclick="handlePayment(' + JSON.stringify(pkg).replace(/"/g, '&quot;') + ')">';
                if (isPopular) {
                    html += '<div class="package-popular-badge">인기</div>';
                }
                html += '<div class="package-icon-container ' + gradient + '">';
                html += '<div class="package-icon">💰</div>';
                html += '</div>';
                html += '<h4 class="package-name">' + pkg.name + '</h4>';
                html += '<div class="package-coins">' + pkg.coins.toLocaleString() + '</div>';
                html += '<div class="package-coins-label">엽전</div>';
                if (pkg.bonusCoins > 0) {
                    html += '<div class="package-bonus">+' + pkg.bonusCoins + ' 보너스</div>';
                }
                html += '<div class="package-price">₩' + parseInt(pkg.price).toLocaleString() + '</div>';
                html += '<button class="package-btn">' + (isPopular ? '구매하기' : '구매하기') + '</button>';
                html += '</div>';
            }
            
            container.innerHTML = html;
        }

        document.addEventListener('DOMContentLoaded', renderPackages);
    </script>
</body>
</html>
    \`);
  } catch (error) {
    console.error('Error serving payment page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 웹훅 엔드포인트
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', req.body);
    
    const { sessionId, userId, packageId, amount, coins, bonusCoins, status } = req.body;
    
    if (!sessionId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing session data' });
    }

    const sessionData = {
      sessionId: sessionId,
      userId: userId,
      packageId: packageId,
      amount: amount,
      coins: coins,
      bonusCoins: bonusCoins || 0
    };

    const result = await notifyMainService(sessionData, status);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log('Payment service running on port', PORT);
});

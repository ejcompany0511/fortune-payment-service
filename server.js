const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 메모리 저장소
const paymentSessions = new Map();

app.use(cors({
  origin: function (origin, callback) {
    // 모든 도메인에서의 접근을 허용 (복제 서비스들을 위해)
    callback(null, true);
  },
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 설정
const IAMPORT_IMP_CODE = 'imp25772872';
// MAIN_SERVICE_URL을 webhookUrl에서 동적으로 추출하도록 변경
function getMainServiceUrl(webhookUrl) {
  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      console.log('Invalid webhookUrl, using fallback');
    }
  }
  // 기본 fallback (개발환경용)
  return process.env.MAIN_SERVICE_URL || 'https://4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
}
// 동적 웹훅 시크릿 처리 함수
function getWebhookSecret(providedSecret) {
  return providedSecret || process.env.WEBHOOK_SECRET || 'EveryUnse2024PaymentSecureWebhook!@#';
}

function getReturnUrl(webhookUrl) {
  // webhookUrl에서 도메인 추출하여 return URL 생성
  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      return `${url.protocol}//${url.host}/`;
    } catch (error) {
      console.log('Invalid webhookUrl, using default return URL');
    }
  }
  
  // 기본값 (기존 로직 유지)
  const hostname = process.env.NODE_ENV === 'production' ? 'www.everyunse.com' : '4c3fcf58-6c3c-41e7-8ad1-bf9cfba0bc03-00-1kaqcmy7wgd8e.riker.replit.dev';
  return 'https://' + hostname + '/';
}

async function getCoinPackages(webhookUrl) {
  try {
    const mainServiceUrl = getMainServiceUrl(webhookUrl);
    console.log('Fetching coin packages from:', mainServiceUrl + '/api/coin-packages');
    const response = await axios.get(mainServiceUrl + '/api/coin-packages');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch coin packages:', error.message);
    // 전체 패키지 fallback 데이터 (7개)
    return [
      { id: 5, name: "40엽전", coins: 40, bonusCoins: 0, price: 3000 },
      { id: 6, name: "100엽전", coins: 100, bonusCoins: 10, price: 6900 },
      { id: 7, name: "220엽전", coins: 220, bonusCoins: 30, price: 14900 },
      { id: 8, name: "500엽전", coins: 500, bonusCoins: 100, price: 29900 },
      { id: 9, name: "1200엽전", coins: 1200, bonusCoins: 300, price: 69900 },
      { id: 10, name: "2500엽전", coins: 2500, bonusCoins: 750, price: 139900 },
      { id: 11, name: "6000엽전", coins: 6000, bonusCoins: 2000, price: 299900 }
    ];
  }
}

function extractSessionFromOID(oid) {
  // oid에서 세션 ID 추출 (예: order_session_123456_timestamp)
  const sessionMatch = oid.match(/order_(.+?)_\d+$/);
  return sessionMatch ? sessionMatch[1] : null;
}

async function notifyMainService(sessionData, status) {
  try {
    // 동적 웹훅 URL 설정 - webhookUrl이 전달되면 사용, 없으면 기본값
    const webhookUrl = sessionData.webhookUrl || (getMainServiceUrl() + '/api/payment/webhook');
    // 동적 웹훅 시크릿 설정 - 각 서비스별 고유 시크릿 사용
    const webhookSecret = getWebhookSecret(sessionData.webhookSecret);
    
    const payload = {
      sessionId: sessionData.sessionId,
      transactionId: sessionData.transactionId,
      merchantUid: sessionData.merchantUid,
      userId: sessionData.userId,
      packageId: sessionData.packageId,
      amount: sessionData.amount,
      coins: sessionData.coins,
      bonusCoins: sessionData.bonusCoins || 0,
      status: status,
      webhookSecret: webhookSecret,
      timestamp: new Date().toISOString()
    };

    console.log('Sending webhook to target service:', webhookUrl);
    console.log('Webhook payload:', payload);

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('Webhook response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to notify target service:', error.message);
    throw error;
  }
}

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 메인 엽전 상점 페이지
app.get('/', async (req, res) => {
  try {
    const { userId, sessionId, returnTo, webhookUrl, webhookSecret } = req.query;

    const packages = await getCoinPackages(webhookUrl);
    console.log('Serving payment page for session:', sessionId, 'user:', userId);
    console.log('Available packages:', packages);

    // HTML 템플릿을 문자열 연결로 생성하여 변수 보간 문제 해결
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>엽전 상점 - EveryUnse</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; min-height: 100vh; color: #333; }
        .container { max-width: 448px; margin: 0 auto; background: #f9fafb; min-height: 100vh; position: relative; padding-bottom: 80px; }
        
        /* Header */
        .header { position: sticky; top: 0; z-index: 50; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-bottom: 1px solid #e5e7eb; }
        .header-content { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .back-btn { background: none; border: none; color: #6b7280; padding: 8px; border-radius: 6px; cursor: pointer; }
        .header-title { font-size: 18px; font-weight: 600; color: #111827; }
        .balance-info { font-size: 14px; color: #6b7280; }
        
        /* Hero Section */
        .hero { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 24px 16px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; top: -50%; right: -20%; width: 100px; height: 100px; background: rgba(255, 255, 255, 0.1); border-radius: 50%; }
        .hero-content { position: relative; z-index: 10; }
        .hero-title { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
        .hero-subtitle { font-size: 14px; opacity: 90%; }
        .hero-icon { position: absolute; bottom: -16px; right: -16px; font-size: 48px; opacity: 20%; }
        
        /* Package Grid */
        .packages-section { padding: 16px; }
        .section-title { font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 16px; }
        .packages-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; padding-top: 12px; }
        
        .package-card { background: white; border-radius: 12px; padding: 20px 16px 16px; text-align: center; position: relative; overflow: visible; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
        .package-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
        .package-card.popular { border: 2px solid #3b82f6; }
        .package-card.selected { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
        
        .popular-badge { position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; font-size: 12px; padding: 4px 8px; border-radius: 12px; font-weight: 500; z-index: 10; white-space: nowrap; }
        
        .package-icon { width: 48px; height: 48px; border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; }
        .gradient-blue { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
        .gradient-purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .gradient-pink { background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); }
        .gradient-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .gradient-orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .gradient-red { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .gradient-indigo { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }
        
        .package-name { font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 8px; }
        .package-details { margin-bottom: 12px; }
        .coins-info { font-size: 14px; color: #6b7280; }
        .bonus-info { font-size: 12px; color: #059669; margin-top: 2px; }
        .package-price { font-size: 16px; font-weight: bold; color: #111827; }
        .original-price { font-size: 12px; color: #9ca3af; text-decoration: line-through; margin-right: 4px; }
        
        /* Payment Button */
        .payment-section { padding: 16px; position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 448px; background: white; border-top: 1px solid #e5e7eb; }
        .payment-btn { width: 100%; background: #8b5cf6; color: white; border: none; border-radius: 12px; padding: 16px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .payment-btn:hover { background: #7c3aed; }
        .payment-btn:disabled { background: #d1d5db; cursor: not-allowed; }
        
        /* Info Sections */
        .info-section { background: white; margin: 16px; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
        .info-title { font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .info-content { font-size: 14px; color: #6b7280; line-height: 1.6; }
        .info-list { list-style: none; }
        .info-list li { padding: 4px 0; position: relative; padding-left: 16px; }
        .info-list li::before { content: '•'; color: #3b82f6; position: absolute; left: 0; }
        
        /* FAQ */
        .faq-item { margin-bottom: 16px; }
        .faq-question { font-weight: 600; color: #111827; margin-bottom: 4px; }
        .faq-answer { font-size: 14px; color: #6b7280; }
    </style>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
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
            </div>
        </header>

        <!-- Hero Section -->
        <section class="hero">
            <div class="hero-content">
                <h2 class="hero-title">엽전을 충전하세요</h2>
                <p class="hero-subtitle">더 많은 운세를 확인하려면 엽전이 필요해요</p>
            </div>
            <div class="hero-icon">💰</div>
        </section>

        <!-- Packages -->
        <section class="packages-section">
            <h3 class="section-title">엽전 패키지</h3>
            <div class="packages-grid" id="packagesGrid">
                <!-- 패키지들이 여기에 동적으로 추가됩니다 -->
            </div>
        </section>

        <!-- Payment Info -->
        <section class="info-section">
            <h4 class="info-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                지원 결제수단
            </h4>
            <div class="info-content">
                <ul class="info-list">
                    <li>신용카드 (국내 모든 카드사)</li>
                    <li>계좌이체</li>
                    <li>휴대폰 소액결제</li>
                    <li>카카오페이, 네이버페이</li>
                </ul>
            </div>
        </section>

        <!-- Security Info -->
        <section class="info-section">
            <h4 class="info-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                안전한 결제
            </h4>
            <div class="info-content">
                <ul class="info-list">
                    <li>SSL 보안인증서 적용</li>
                    <li>KG이니시스 안전결제 시스템</li>
                    <li>개인정보 암호화 처리</li>
                    <li>PCI DSS 인증 완료</li>
                </ul>
            </div>
        </section>

        <!-- FAQ -->
        <section class="info-section">
            <h4 class="info-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <point cx="12" cy="17"/>
                </svg>
                자주 묻는 질문
            </h4>
            <div class="info-content">
                <div class="faq-item">
                    <div class="faq-question">Q. 엽전 사용 기간이 있나요?</div>
                    <div class="faq-answer">A. 엽전은 획득일로부터 1년간 사용 가능합니다.</div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">Q. 결제 후 언제 엽전이 충전되나요?</div>
                    <div class="faq-answer">A. 결제 완료 후 즉시 자동으로 충전됩니다.</div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">Q. 환불이 가능한가요?</div>
                    <div class="faq-answer">A. 사용하지 않은 엽전에 한해 7일 이내 환불 가능합니다.</div>
                </div>
            </div>
        </section>
    </div>

    <!-- Payment Button (Fixed at bottom) -->
    <div class="payment-section">
        <button class="payment-btn" id="paymentBtn" onclick="processPayment()" disabled>
            패키지를 선택해주세요
        </button>
    </div>

    <script>
        const sessionData = {
            userId: '` + (userId || '') + `',
            sessionId: '` + (sessionId || '') + `',
            returnTo: '` + (returnTo || '') + `',
            webhookUrl: '` + (webhookUrl || '') + `',
            webhookSecret: '` + (webhookSecret || '') + `'
        };

        const packages = ` + JSON.stringify(packages) + `;

        function getGradientClass(index) {
            const gradients = ['gradient-blue', 'gradient-purple', 'gradient-pink', 'gradient-green', 'gradient-orange', 'gradient-red', 'gradient-indigo'];
            return gradients[index % gradients.length];
        }

        function formatPrice(price) {
            return new Intl.NumberFormat('ko-KR').format(parseFloat(price));
        }

        let selectedPackage = null;

        function renderPackages() {
            const grid = document.getElementById('packagesGrid');
            if (!grid || !packages) return;

            grid.innerHTML = packages.map((pkg, index) => {
                const isPopular = pkg.isPopular || pkg.is_popular;
                const bonusHtml = pkg.bonusCoins > 0 ? '<div class="bonus-info">보너스 +' + pkg.bonusCoins + '엽전</div>' : '';
                
                return '<div class="package-card ' + (isPopular ? 'popular' : '') + '" onclick="selectPackage(' + pkg.id + ')">' +
                    (isPopular ? '<div class="popular-badge">인기</div>' : '') +
                    '<div class="package-icon ' + getGradientClass(index) + '">💰</div>' +
                    '<div class="package-name">' + pkg.name + '</div>' +
                    '<div class="package-details">' +
                        '<div class="coins-info">' + pkg.coins + '엽전</div>' +
                        bonusHtml +
                    '</div>' +
                    '<div class="package-price">₩' + formatPrice(pkg.price) + '</div>' +
                '</div>';
            }).join('');
        }

        function selectPackage(packageId) {
            selectedPackage = packages.find(p => p.id === packageId);
            if (!selectedPackage) return;

            console.log('Selected package:', selectedPackage);
            
            // 모든 카드에서 selected 클래스 제거
            document.querySelectorAll('.package-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // 선택된 카드에 selected 클래스 추가
            event.currentTarget.classList.add('selected');
            
            // 결제 버튼 활성화
            const paymentBtn = document.getElementById('paymentBtn');
            paymentBtn.disabled = false;
            paymentBtn.textContent = selectedPackage.name + ' 구매하기 (₩' + formatPrice(selectedPackage.price) + ')';
        }

        async function processPayment() {
            if (!selectedPackage) {
                alert('패키지를 선택해주세요.');
                return;
            }

            if (!sessionData.userId || !sessionData.sessionId) {
                alert('세션 정보가 없습니다. 다시 시도해주세요.');
                return;
            }

            try {
                // 세션 업데이트 API 호출
                const updateResponse = await fetch('/api/update-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: sessionData.sessionId,
                        userId: sessionData.userId,
                        packageId: selectedPackage.id,
                        webhookUrl: sessionData.webhookUrl
                    })
                });

                if (!updateResponse.ok) {
                    throw new Error('세션 업데이트 실패');
                }

                // Iamport 결제 진행
                const IMP = window.IMP;
                IMP.init('` + IAMPORT_IMP_CODE + `');

                const merchantUid = 'order_' + sessionData.sessionId + '_' + Date.now();
                
                IMP.request_pay({
                    pg: 'html5_inicis',
                    pay_method: 'card',
                    merchant_uid: merchantUid,
                    name: selectedPackage.name,
                    amount: selectedPackage.price,
                    buyer_email: '',
                    buyer_name: 'EveryUnse User',
                    buyer_tel: '',
                    buyer_addr: '',
                    buyer_postcode: '',
                    custom_data: {
                        sessionId: sessionData.sessionId,
                        userId: sessionData.userId,
                        packageId: selectedPackage.id,
                        coins: selectedPackage.coins,
                        bonusCoins: selectedPackage.bonusCoins || 0,
                        webhookUrl: sessionData.webhookUrl
                    }
                }, function(rsp) {
                    if (rsp.success) {
                        console.log('Payment successful:', rsp);
                        
                        fetch('/webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: sessionData.sessionId,
                                userId: sessionData.userId,
                                packageId: selectedPackage.id,
                                amount: selectedPackage.price,
                                coins: selectedPackage.coins,
                                bonusCoins: selectedPackage.bonusCoins || 0,
                                status: 'completed',
                                transactionId: rsp.imp_uid,
                                merchantUid: rsp.merchant_uid,
                                webhookUrl: sessionData.webhookUrl
                            })
                        }).then(response => response.json())
                          .then(result => {
                              console.log('Webhook result:', result);
                              if (result.success) {
                                  alert('결제가 완료되었습니다! 원래 페이지로 이동합니다.');
                                  const returnUrl = getReturnUrl(sessionData.webhookUrl);
                                  const finalUrl = returnUrl + (sessionData.returnTo ? '?returnTo=' + sessionData.returnTo : '');
                                  console.log('Redirecting to:', finalUrl);
                                  window.location.href = finalUrl;
                              } else {
                                  throw new Error(result.error || '결제 처리 중 오류가 발생했습니다.');
                              }
                          })
                          .catch(error => {
                              console.error('Webhook error:', error);
                              alert('결제는 완료되었지만 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.');
                          });
                    } else {
                        console.log('Payment failed:', rsp);
                        alert('결제가 실패했습니다: ' + rsp.error_msg);
                    }
                });
                
            } catch (error) {
                console.error('Payment error:', error);
                alert('결제 처리 중 오류가 발생했습니다.');
            }
        }

        function getReturnUrl(webhookUrl) {
            if (webhookUrl) {
                try {
                    const url = new URL(webhookUrl);
                    return url.origin + '/';
                } catch (error) {
                    console.log('Invalid webhookUrl, using fallback');
                }
            }
            return window.location.origin || 'https://everyunse.com/';
        }

        function goBack() {
            try {
                const returnUrl = getReturnUrl(sessionData.webhookUrl);
                const finalUrl = returnUrl + (sessionData.returnTo ? '?returnTo=' + sessionData.returnTo : '');
                console.log('Going back to:', finalUrl);
                window.location.href = finalUrl;
            } catch (error) {
                console.error('Navigation error:', error);
                window.history.back();
            }
        }

        // 초기 렌더링
        document.addEventListener('DOMContentLoaded', function() {
            renderPackages();
        });
    </script>
</body>
</html>`;

    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving payment page:', error);
    res.status(500).json({ error: 'Failed to load payment page' });
  }
});

// 세션 업데이트 API
app.post('/api/update-session', async (req, res) => {
  try {
    const { sessionId, userId, packageId, webhookUrl } = req.body;
    
    if (!sessionId || !userId || !packageId) {
      return res.status(400).json({ success: false, error: 'Missing required data' });
    }

    // 메인 서비스에 세션 업데이트 요청
    const mainServiceUrl = getMainServiceUrl(webhookUrl);
    const updateResponse = await axios.post(mainServiceUrl + '/api/payment/update-session', {
      sessionId,
      userId,
      packageId,
      webhookUrl
    });

    console.log('Session update response:', updateResponse.data);
    res.json({ success: true, data: updateResponse.data });
    
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 웹훅 엔드포인트
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', req.body);
    
    const { sessionId, userId, packageId, amount, coins, bonusCoins, status, transactionId, merchantUid, webhookUrl } = req.body;
    
    if (!sessionId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing session data' });
    }

    const sessionData = {
      sessionId: sessionId,
      transactionId: transactionId,
      merchantUid: merchantUid,
      userId: userId,
      packageId: packageId,
      amount: amount,
      coins: coins,
      bonusCoins: bonusCoins || 0,
      webhookUrl: webhookUrl
    };

    const result = await notifyMainService(sessionData, status);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// KG Inicis 웹훅 처리 (legacy)
app.post('/kg-inicis-webhook', async (req, res) => {
  try {
    console.log('KG Inicis webhook received:', req.body);
    
    const {
      resultCode,
      resultMsg,
      mid,
      oid,
      price,
      MOID,
      authToken,
      payMethod,
      timestamp
    } = req.body;

    if (resultCode === '0000') {
      // 성공
      console.log('Payment successful for order:', oid);
      
      // OID에서 세션 ID 추출
      const sessionId = extractSessionFromOID(oid);
      console.log('Extracted session ID:', sessionId);
      
      if (sessionId && paymentSessions.has(sessionId)) {
        const sessionData = paymentSessions.get(sessionId);
        console.log('Found session data:', sessionData);
        
        // 메인 서비스에 완료 알림
        await notifyMainService({
          ...sessionData,
          transactionId: authToken || oid,
          merchantUid: oid,
          amount: parseInt(price)
        }, 'completed');
        
        // 세션 삭제
        paymentSessions.delete(sessionId);
        
        res.send('OK');
      } else {
        console.error('Session not found:', sessionId);
        res.status(400).send('Session not found');
      }
    } else {
      // 실패
      console.log('Payment failed:', resultMsg);
      const sessionId = extractSessionFromOID(oid);
      
      if (sessionId && paymentSessions.has(sessionId)) {
        const sessionData = paymentSessions.get(sessionId);
        await notifyMainService({
          ...sessionData,
          transactionId: authToken || oid,
          merchantUid: oid,
          amount: parseInt(price)
        }, 'failed');
        
        paymentSessions.delete(sessionId);
      }
      
      res.send('FAIL');
    }
  } catch (error) {
    console.error('KG Inicis webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.listen(PORT, () => {
  console.log('Payment service running on port', PORT);
});

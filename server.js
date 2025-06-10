const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Environment variables
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'https://www.everyunse.com';
const IMP_KEY = process.env.IMP_KEY; // 포트원 REST API Key
const IMP_SECRET = process.env.IMP_SECRET; // 포트원 REST API Secret

// Payment sessions storage (in production, use Redis or database)
const paymentSessions = new Map();

// Store session data from main service
app.post('/api/store-session', (req, res) => {
  try {
    const sessionData = req.body;
    console.log('Storing session data:', sessionData);
    
    if (!sessionData.sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    paymentSessions.set(sessionData.sessionId, sessionData);
    console.log(`Stored session ${sessionData.sessionId} successfully`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error storing session:', error);
    res.status(500).json({ error: 'Failed to store session' });
  }
});

// Get payment session data from main service
async function getPaymentSession(sessionId) {
  try {
    console.log('Getting session for ID:', sessionId);
    
    // First check local storage
    if (paymentSessions.has(sessionId)) {
      console.log('Found session in local storage');
      return paymentSessions.get(sessionId);
    }
    
    // Fallback: get from main service if not found locally
    console.log('Session not found locally, fetching from main service...');
    const response = await axios.get(`${MAIN_SERVICE_URL}/api/payment/session/${sessionId}`);
    return response.data;
    
  } catch (error) {
    console.error('Error getting payment session:', error);
    return null;
  }
}

// Payment page
app.get('/payment', async (req, res) => {
  try {
    const sessionId = req.query.session;
    
    if (!sessionId) {
      return res.render('error', { 
        message: '결제 세션 ID가 필요합니다.',
        returnUrl: MAIN_SERVICE_URL 
      });
    }
    
    const sessionData = await getPaymentSession(sessionId);
    
    if (!sessionData) {
      return res.render('error', { 
        message: '결제 세션을 찾을 수 없습니다.',
        returnUrl: MAIN_SERVICE_URL 
      });
    }
    
    const merchantUid = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Store merchant_uid mapping for verification
    paymentSessions.set(merchantUid, sessionData);
    
    res.render('payment', {
      merchantUid,
      packageName: sessionData.packageName,
      amount: sessionData.amount,
      coins: sessionData.coins,
      bonusCoins: sessionData.bonusCoins || 0,
      impKey: IMP_KEY,
      returnUrl: MAIN_SERVICE_URL
    });
    
  } catch (error) {
    console.error('Error rendering payment page:', error);
    res.render('error', { 
      message: '결제 페이지 로드 중 오류가 발생했습니다.',
      returnUrl: MAIN_SERVICE_URL 
    });
  }
});

// Payment verification
app.post('/verify-payment', async (req, res) => {
  try {
    const { imp_uid, merchant_uid, success } = req.body;
    
    console.log('Payment verification request:', { imp_uid, merchant_uid, success });
    
    // Get session data
    const sessionData = paymentSessions.get(merchant_uid);
    
    if (!sessionData) {
      return res.json({ 
        success: false, 
        error: '결제 세션을 찾을 수 없습니다.',
        redirectUrl: MAIN_SERVICE_URL 
      });
    }
    
    if (success) {
      // Payment successful - verify with Portone and notify main service
      try {
        // Get access token
        const tokenResponse = await axios.post('https://api.iamport.kr/users/getToken', {
          imp_key: IMP_KEY,
          imp_secret: IMP_SECRET
        });
        
        const accessToken = tokenResponse.data.response.access_token;
        
        // Verify payment
        const paymentResponse = await axios.get(`https://api.iamport.kr/payments/${imp_uid}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const paymentData = paymentResponse.data.response;
        
        if (paymentData.amount === sessionData.amount && paymentData.status === 'paid') {
          // Payment verified - notify main service
          const notificationData = {
            paymentId: sessionData.paymentId,
            status: 'completed',
            externalPaymentId: imp_uid,
            merchantUid: merchant_uid,
            amount: paymentData.amount,
            paidAt: paymentData.paid_at
          };
          
          await axios.post(`${MAIN_SERVICE_URL}/api/payment/complete`, notificationData);
          
          // Clean up session
          paymentSessions.delete(merchant_uid);
          paymentSessions.delete(sessionData.sessionId);
          
          res.json({ 
            success: true, 
            redirectUrl: `${MAIN_SERVICE_URL}/coins?payment=success`
          });
          
        } else {
          throw new Error('Payment verification failed');
        }
        
      } catch (error) {
        console.error('Payment verification error:', error);
        
        // Notify main service of failure
        const notificationData = {
          paymentId: sessionData.paymentId,
          status: 'failed',
          error: error.message
        };
        
        await axios.post(`${MAIN_SERVICE_URL}/api/payment/complete`, notificationData);
        
        res.json({ 
          success: false, 
          error: '결제 검증에 실패했습니다.',
          redirectUrl: `${MAIN_SERVICE_URL}/coins?payment=failed`
        });
      }
      
    } else {
      // Payment failed or cancelled
      try {
        const notificationData = {
          paymentId: sessionData.paymentId,
          status: 'cancelled',
          merchantUid: merchant_uid
        };
        
        await axios.post(`${MAIN_SERVICE_URL}/api/payment/complete`, notificationData);
        
        // Clean up session
        paymentSessions.delete(merchant_uid);
        paymentSessions.delete(sessionData.sessionId);
        
        res.json({ 
          success: false, 
          error: '결제가 취소되었습니다.',
          redirectUrl: sessionData.returnUrl || MAIN_SERVICE_URL
        });
        
      } catch (error) {
        console.error('Error notifying main service of failure:', error);
        res.json({ 
          success: false, 
          error: '결제 취소 처리 중 오류가 발생했습니다.' 
        });
      }
    }
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.json({ success: false, error: '결제 확인 중 오류가 발생했습니다.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    sessionsCount: paymentSessions.size
  });
});

// Error page fallback
app.get('*', (req, res) => {
  res.status(404).render('error', { 
    message: '페이지를 찾을 수 없습니다.',
    returnUrl: MAIN_SERVICE_URL 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Payment service running on port ${PORT}`);
  console.log('Main service URL:', MAIN_SERVICE_URL);
  console.log('Portone IMP_KEY configured:', !!IMP_KEY);
});

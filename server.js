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
    console.log(`Fetching session data from: ${MAIN_SERVICE_URL}/api/payment/session/${sessionId}`);
    const response = await axios.get(`${MAIN_SERVICE_URL}/api/payment/session/${sessionId}`);
    console.log('Session data received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to get payment session:', error);
    console.error('Error details:', error.response?.data || error.message);
    return null;
  }
}

// Payment page route
app.get('/payment', async (req, res) => {
  try {
    const { session: sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).render('error', { 
        message: '잘못된 결제 요청입니다.',
        returnUrl: MAIN_SERVICE_URL 
      });
    }

    // First check local storage, then fallback to main service
    let sessionData = paymentSessions.get(sessionId);
    
    if (!sessionData) {
      console.log(`Session ${sessionId} not found in local storage, fetching from main service`);
      sessionData = await getPaymentSession(sessionId);
    } else {
      console.log(`Found session ${sessionId} in local storage:`, sessionData);
    }
    
    if (!sessionData) {
      return res.status(404).render('error', { 
        message: '결제 세션을 찾을 수 없습니다.',
        returnUrl: MAIN_SERVICE_URL 
      });
    }

    // Generate merchant_uid for this payment
    const merchantUid = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session with merchant_uid
    paymentSessions.set(merchantUid, {
      ...sessionData,
      sessionId,
      merchantUid
    });

    console.log('Generated merchant_uid:', merchantUid);
    console.log('Session data prepared:', sessionData);

    // Render payment page with session data
    res.render('payment', {
      sessionData: sessionData,
      merchantUid: merchantUid,
      impKey: IMP_KEY,
      amount: sessionData.amount,
      packageName: sessionData.packageName || `${sessionData.coins} 코인`,
      coins: sessionData.coins,
      bonusCoins: sessionData.bonusCoins || 0,
      returnUrl: sessionData.returnUrl || MAIN_SERVICE_URL
    });

  } catch (error) {
    console.error('Payment page error:', error);
    res.status(500).render('error', { 
      message: '결제 페이지 로딩 중 오류가 발생했습니다.',
      returnUrl: MAIN_SERVICE_URL 
    });
  }
});

// Payment verification endpoint
app.post('/verify-payment', async (req, res) => {
  try {
    console.log('Payment verification request:', req.body);
    
    const { imp_uid, merchant_uid, success } = req.body;
    
    if (!merchant_uid) {
      return res.json({ success: false, error: 'Missing merchant_uid' });
    }

    // Get session data
    const sessionData = paymentSessions.get(merchant_uid);
    
    if (!sessionData) {
      console.log('Session not found for merchant_uid:', merchant_uid);
      return res.json({ success: false, error: 'Session not found' });
    }

    console.log('Found session data for verification:', sessionData);

    if (success === 'true' || success === true) {
      // Payment successful
      console.log('Payment successful, notifying main service');
      
      try {
        // Notify main service
        const notificationData = {
          success: true,
          sessionId: sessionData.sessionId,
          merchantUid: merchant_uid,
          impUid: imp_uid,
          amount: sessionData.amount,
          coins: sessionData.coins,
          bonusCoins: sessionData.bonusCoins || 0,
          packageId: sessionData.packageId,
          userId: sessionData.userId
        };

        console.log('Sending notification to main service:', notificationData);

        const response = await axios.post(`${MAIN_SERVICE_URL}/api/payment/complete`, notificationData);
        
        console.log('Main service response:', response.data);
        
        // Clean up session
        paymentSessions.delete(merchant_uid);
        paymentSessions.delete(sessionData.sessionId);
        
        res.json({ 
          success: true, 
          message: '결제가 완료되었습니다.',
          redirectUrl: sessionData.returnUrl || MAIN_SERVICE_URL
        });
        
      } catch (error) {
        console.error('Error notifying main service:', error);
        res.json({ 
          success: false, 
          error: '결제 완료 처리 중 오류가 발생했습니다.' 
        });
      }
      
    } else {
      // Payment failed
      console.log('Payment failed');
      
      try {
        const notificationData = {
          success: false,
          sessionId: sessionData.sessionId,
          merchantUid: merchant_uid,
          errorMessage: '결제가 취소되었습니다.'
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

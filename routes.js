/**
 * API Routes for FCM Token Management
 */

/**
 * POST /setToken
 * Store or update FCM token for a user
 */
function setTokenRoute(req, res, db) {
  const { userId, deviceId, fcmToken } = req.body;

  // Validate input
  if (!userId || !deviceId || !fcmToken) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userId, deviceId, fcmToken'
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO user_tokens (user_id, device_id, fcm_token, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        device_id = excluded.device_id,
        fcm_token = excluded.fcm_token,
        updated_at = excluded.updated_at
    `);

    const timestamp = Date.now();
    stmt.run(userId, deviceId, fcmToken, timestamp);

    console.log(`[API] Token set for ${userId}`);

    res.json({
      success: true,
      userId,
      deviceId,
      fcmToken
    });
  } catch (error) {
    console.error('[API] setToken error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /getToken
 * Retrieve FCM token for a user
 */
function getTokenRoute(req, res, db) {
  const { userId } = req.body;

  // Validate input
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: userId'
    });
  }

  try {
    const stmt = db.prepare('SELECT * FROM user_tokens WHERE user_id = ?');
    const row = stmt.get(userId);

    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Token not found for user'
      });
    }

    console.log(`[API] Token retrieved for ${userId}`);

    res.json({
      success: true,
      userId: row.user_id,
      deviceId: row.device_id,
      fcmToken: row.fcm_token
    });
  } catch (error) {
    console.error('[API] getToken error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  setTokenRoute,
  getTokenRoute
};

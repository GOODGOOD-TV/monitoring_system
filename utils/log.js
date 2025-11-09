// routes/utils/log.js
const { pool } = require('../../db');
async function audit(req, action, desc = '') {
  try {
    const company_code = req.user?.company_code || null;
    const user_id = req.user?.id || null;
    await pool.execute(
      `INSERT INTO sys_logs(company_code,user_id,action,description,ip,ts)
       VALUES (?,?,?,?,?,NOW())`,
      [company_code, user_id, action, desc, req.ip]
    );
  } catch (e) {
    console.error('audit fail', e);
  }
}
module.exports = { audit };

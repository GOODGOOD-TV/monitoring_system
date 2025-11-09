// routes/utils/validate.js
function requireFields(obj, fields) {
  for (const f of fields) {
    if (obj[f] == null || obj[f] === '') {
      const e = new Error(`Missing field: ${f}`);
      e.status = 400;
      e.code = 'BAD_REQUEST';
      throw e;
    }
  }
}
module.exports = { requireFields };

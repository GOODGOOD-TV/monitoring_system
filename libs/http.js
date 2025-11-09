//http 응답 헬퍼
export function attachResHelpers(_req, res, next) {
  res.ok = (data = {}, message = '성공') =>
    res.status(200).json({ is_sucsess: true, message, data });

  res.created = (data = {}, message = '생성 성공') =>
    res.status(201).json({ is_sucsess: true, message, data });

  res.accepted = (data = {}, message = '요청 접수') =>
    res.status(202).json({ is_sucsess: true, message, data });

  res.fail = (status = 400, code = 'BAD_REQUEST', message = '요청 오류', details = null) =>
    res.status(status).json({
      is_sucsess: false,
      message: code,
      error: { code, message, details },
    });

  next();
}

// 키가 없을 때 고정값으로 대체하면 누구나 관리자 토큰을 위조할 수 있으므로 실패시킨다
export const getAdminJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret?.trim()) {
    throw new Error("JWT_SECRET 환경 변수가 설정되지 않았습니다.");
  }
  return secret;
};

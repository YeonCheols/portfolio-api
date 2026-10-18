const databaseUrl = process.env.DATABASE_URL ?? "";
const directUrl = process.env.DATABASE_DIRECT_URL ?? "";
const localTestUrl =
  /^postgresql:\/\/test:test@127\.0\.0\.1:\d+\/portfolio_test$/;

if (!localTestUrl.test(databaseUrl) || databaseUrl !== directUrl) {
  throw new Error(
    "통합 테스트는 127.0.0.1의 portfolio_test만 사용합니다. pnpm test:integration으로 실행합니다",
  );
}

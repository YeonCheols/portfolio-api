const LOCAL_PORT = 4001;

export function resolveListenPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return LOCAL_PORT;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT가 올바른 포트 번호가 아닙니다: ${raw}`);
  }
  return port;
}

export function canAdvancePortOnConflict(raw: string | undefined): boolean {
  return raw === undefined || raw.trim() === "";
}

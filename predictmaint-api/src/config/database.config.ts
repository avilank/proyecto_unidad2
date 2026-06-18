import { registerAs } from '@nestjs/config';

function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      name: parsed.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

export default registerAs('database', () => {
  const hasSplitConfig =
    Boolean(process.env.DATABASE_HOST) || Boolean(process.env.DATABASE_USER);

  const url = hasSplitConfig
    ? undefined
    : (process.env.DATABASE_URL ??
      'postgres://predictmaint:predictmaint@localhost:5432/predictmaint');

  const fromUrl = url ? parseDatabaseUrl(url) : null;

  return {
    url,
    host: process.env.DATABASE_HOST ?? fromUrl?.host ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? String(fromUrl?.port ?? 5432), 10),
    username: process.env.DATABASE_USER ?? fromUrl?.username ?? 'predictmaint',
    password: process.env.DATABASE_PASSWORD ?? fromUrl?.password ?? 'predictmaint',
    name: process.env.DATABASE_NAME ?? fromUrl?.name ?? 'predictmaint',
    sync: process.env.DATABASE_SYNC ?? 'true',
    alter: process.env.DATABASE_ALTER ?? 'false',
    force: process.env.DATABASE_FORCE ?? 'false',
    logging: process.env.DATABASE_LOGGING ?? 'false',
    seed: process.env.DATABASE_SEED ?? 'true',
  };
});

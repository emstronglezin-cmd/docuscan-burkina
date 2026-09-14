export interface AppConfig {
  env: string;
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    ssl: boolean;
    synchronize: boolean;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  saspay: {
    apiKey: string;
    baseUrl: string;
    webhookSigningSecret: string;
    defaultCountry: string;
    defaultCurrency: string;
    returnUrl: string;
  };
  admin: {
    bootstrapEmail: string;
    bootstrapPassword: string;
  };
  scan: {
    fcfaPerCredit: number;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'docuscan',
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'CHANGE_ME_ACCESS_SECRET',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '30m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'CHANGE_ME_REFRESH_SECRET',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  saspay: {
    apiKey: process.env.SASPAY_API_KEY ?? '',
    baseUrl: process.env.SASPAY_BASE_URL ?? 'https://api.saspay.me/api/v1',
    webhookSigningSecret: process.env.SASPAY_WEBHOOK_SECRET ?? '',
    defaultCountry: process.env.SASPAY_DEFAULT_COUNTRY ?? 'BF',
    defaultCurrency: process.env.SASPAY_DEFAULT_CURRENCY ?? 'XOF',
    returnUrl: process.env.SASPAY_RETURN_URL ?? '',
  },
  admin: {
    bootstrapEmail: process.env.ADMIN_BOOTSTRAP_EMAIL ?? '',
    bootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '',
  },
  scan: {
    fcfaPerCredit: parseInt(process.env.FCFA_PER_CREDIT ?? '50', 10),
  },
});

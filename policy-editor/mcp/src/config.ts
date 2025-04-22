import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    LOG_LEVEL: z.string().optional(),
    GITHUB_APP_ID: z.string(),
    GITHUB_APP_PRIVATE_KEY: z.string(), // PEM文字列またはファイルパス
    GITHUB_INSTALLATION_ID: z.string(),
    GITHUB_TARGET_OWNER: z.string(),
    GITHUB_TARGET_REPO: z.string(),
    GITHUB_BASE_BRANCH: z.string().default('main'),
    GITHUB_API_BASE_URL: z.string().optional(), // GHE用
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error(
        '❌ Invalid environment variables:',
        JSON.stringify(parsedEnv.error.format(), null, 4)
    );
    process.exit(1);
}

export default parsedEnv.data;
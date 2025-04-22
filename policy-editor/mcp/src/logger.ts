import { pino } from 'pino';
import config from './config.js';

// pinoの出力先をstderrに変更
const transport = pino.transport({
    target: 'pino-pretty',
    options: { destination: 2 } // 2はstderrのファイルディスクリプタ
});

const logger = pino({
    level: config.LOG_LEVEL || 'info',
}, transport); // transportを指定

export default logger;
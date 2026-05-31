import {Redis} from 'ioredis'

export const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    // password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times*50,2000)
})

redis.on('connect',()=>{
    console.log('Redis Connected');
})

redis.on('error',(error)=>{
    console.error(`Error connecting Redis: ${error}`);
})
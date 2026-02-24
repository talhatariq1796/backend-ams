import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis();

export const trackActionQueue = new Queue("track-action", {
  connection,
});

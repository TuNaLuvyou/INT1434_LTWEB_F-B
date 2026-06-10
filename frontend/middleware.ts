// middleware.ts — Re-export từ proxy.ts để Next.js nhận diện đúng entry point
// Next.js yêu cầu file middleware phải tên là middleware.ts ở root directory

export { proxy as middleware, config } from './proxy';

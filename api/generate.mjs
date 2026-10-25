import { createApi } from '../server/api.mjs';

const api = createApi();

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  req.url = '/api/generate';
  return api(req, res);
}

import { createApi } from '../server/api.mjs';

const api = createApi();

export default async function handler(req, res) {
  req.url = '/api/status';
  return api(req, res);
}

import { createHelpApi } from '../server/help.mjs';
const help = createHelpApi();
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  return help(req, res);
}

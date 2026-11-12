import { getStore } from '@netlify/blobs';
import { handleGameRequest } from '../../server/api.js';

export default async (req) => {
  const store = getStore({ name: 'codewords-rooms', consistency: 'strong' });
  return handleGameRequest(req, store);
};

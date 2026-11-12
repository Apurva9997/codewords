import { httpServer } from '../../server/index.js';

httpServer.listen(process.env.PORT, () => {
  console.log(`Codewords listening on port ${process.env.PORT}`);
});

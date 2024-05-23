import Aedes from 'aedes';
import { createServer } from 'net';

const aedes = new Aedes();
const server = createServer(aedes.handle);

server.listen(1883, () => {
  console.log('server started and listening on port 1883');
});

import { WebWorkerMLCEngineHandler } from 'https://esm.run/@mlc-ai/web-llm@0.2.89';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = event => handler.onmessage(event);

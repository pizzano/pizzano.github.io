import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';
env.allowLocalModels=false;
env.useBrowserCache=true;
let recognizer, pending;
async function getModel(){
 if(recognizer)return recognizer;
 if(!pending)pending=pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{device:'wasm',dtype:'q8',progress_callback:p=>self.postMessage({type:'progress',status:p.status,file:p.file,progress:p.progress})}).then(r=>recognizer=r).finally(()=>pending=null);
 return pending;
}
self.onmessage=async({data:m})=>{try{const asr=await getModel();if(m.type==='load'){self.postMessage({type:'ready'});return}if(m.type!=='transcribe')return;const result=await asr(m.audio,{language:m.language,task:'transcribe',return_timestamps:false});self.postMessage({type:'result',id:m.id,text:result.text||''})}catch(e){self.postMessage({type:'error',id:m.id,message:String(e.message||e)})}};

import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {answerQuestion} from './public/data.js';
import {findScenes,archiveInfo} from './archive.mjs';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const port=Number(process.env.PORT||3000);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const urlSafeError=error=>error.name==='TimeoutError'?'The imagery service took too long. Please try again.':error.message==='fetch failed'?'Cannot reach the satellite catalogue. Check your connection and try again.':error instanceof SyntaxError?'Invalid request JSON.':error.message||'Request failed.';
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>10000)throw new Error('Request too large');}return JSON.parse(text);}
http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
 if(req.method==='GET'&&url.pathname==='/api/image'){
  const upstreamUrl=new URL(url.searchParams.get('url'));
  const allowed=upstreamUrl.protocol==='https:'&&!upstreamUrl.username&&!upstreamUrl.password&&!upstreamUrl.port&&(
   upstreamUrl.hostname==='planetarycomputer.microsoft.com'&&upstreamUrl.pathname.startsWith('/api/data/v1/item/bbox/')||
   upstreamUrl.hostname==='gis.wildlife.ca.gov'&&/^\/images\/rest\/services\/Base_Remote_Sensing\/NAIP_\d{4}\/ImageServer\/exportImage$/.test(upstreamUrl.pathname)||
   upstreamUrl.hostname==='apps.geo.fpac.usda.gov'&&upstreamUrl.pathname==='/geo-imagery/rest/services/naip/conus_naip/ImageServer/exportImage'||
   upstreamUrl.hostname==='imagery.nationalmap.gov'&&upstreamUrl.pathname==='/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage');
  if(!allowed)return json(res,400,{error:'Unsupported imagery source'});
  const image=await fetch(upstreamUrl,{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!image.ok)return json(res,502,{error:'Image service could not render this acquisition.'});
  const contentType=image.headers.get('content-type')||'';
  if(!contentType.startsWith('image/')||Number(image.headers.get('content-length'))>25000000)return json(res,502,{error:'Invalid image response'});
  const chunks=[];let bytes=0;for await(const chunk of image.body){bytes+=chunk.length;if(bytes>25000000)throw new Error('Image response too large');chunks.push(chunk);}
  res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});return res.end(Buffer.concat(chunks));
 }
 if(req.method==='GET'&&url.pathname==='/api/scenes')return json(res,200,await findScenes(url.searchParams.get('bbox'),url.searchParams.get('date')));
 if(req.method==='GET'&&url.pathname==='/api/archive')return json(res,200,await archiveInfo(url.searchParams.get('bbox')));
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json(res,403,{error:'Origin not allowed'});
 const data=await body(req);
 if(url.pathname==='/api/ask'){
 if(typeof data.question!=='string'||!data.question.trim()||data.question.length>1000)return json(res,400,{error:'Enter a question of up to 1,000 characters.'});
 if(data.context)return json(res,404,{error:'Comparison chat has been removed.'});
 return json(res,200,answerQuestion(data.question,data.selectedId));
 }
 return json(res,404,{error:'Unknown endpoint'});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep))return json(res,403,{error:'Forbidden'});
 const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
 }catch(error){json(res,error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Not found':urlSafeError(error)});}
}).listen(port,'127.0.0.1',()=>console.log(`Groundshift: http://localhost:${port}`));

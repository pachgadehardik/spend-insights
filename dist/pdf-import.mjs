import {detectMapping, parseDate} from './core.mjs';

const PDF_LIMIT = 100, OCR_LIMIT = 20, PIXEL_LIMIT = 8_000_000;
const FIELD_NAMES = {date:'Date',description:'Description',debit:'Debit',credit:'Credit',amount:'Amount',type:'Type',balance:'Balance'};
const base = path => new URL(path, import.meta.url).href;
const fail = (code,message,extra={}) => Object.assign(new Error(message),{code,...extra});
const norm = s => String(s||'').toLowerCase().replace(/[^a-z]/g,'');
const dateLike = s => !!(parseDate(s,'DMY')||parseDate(s,'MDY'));

// Reading order is rebuilt from physical coordinates, never from the PDF's
// internal text order. Empty debit/credit cells retain their column positions.
export function textItemsToLines(items) {
  const words=items.filter(i=>typeof i.str==='string'&&i.str.trim()).map(i=>({
    text:i.str.trim(),x:i.transform?.[4]??i.x,y:i.transform?.[5]??i.y,
    width:Math.abs(i.width||0),height:Math.max(1,Math.abs(i.height||i.transform?.[3]||10)),confidence:i.confidence
  })).filter(i=>Number.isFinite(i.x)&&Number.isFinite(i.y)).sort((a,b)=>b.y-a.y||a.x-b.x);
  const lines=[];
  for(const word of words){
    let line=lines.findLast(l=>Math.abs(l.y-word.y)<=Math.max(2,Math.min(l.height,word.height)*.4));
    if(!line){line={y:word.y,height:word.height,items:[]};lines.push(line);}
    line.items.push(word);line.height=Math.max(line.height,word.height);
  }
  return lines.sort((a,b)=>b.y-a.y).map((l,i)=>({...l,line:i+1,items:l.items.sort((a,b)=>a.x-b.x)}));
}
function lineCells(line) {
  const cells=[];
  for(const item of line.items){
    const previous=cells.at(-1),gap=previous?item.x-(previous.x+previous.width):Infinity;
    if(previous&&gap<=Math.max(5,Math.min(item.height,previous.height)*.8)){
      previous.text+=' '+item.text;previous.width=Math.max(previous.width,item.x+item.width-previous.x);
    }else cells.push({...item});
  }
  return cells;
}
function asHeader(line) {
  const cells=lineCells(line),found=detectMapping([cells.map(c=>c.text)]),m=found.map;
  if(m.date<0||m.description<0||(m.amount<0&&m.debit<0&&m.credit<0))return null;
  // A separate numeric column is essential: a sentence mentioning headers is
  // not a transaction table. Unknown extra columns are preserved geometrically.
  if(cells.length<3)return null;
  const bounds=[-Infinity];
  for(let i=1;i<cells.length;i++)bounds.push((cells[i-1].x+cells[i-1].width+cells[i].x)/2);
  bounds.push(Infinity);
  return {cells,map:m,bounds,y:line.y,line:line.line};
}
function rowCells(line,header) {
  const cells=Array.from({length:header.cells.length},()=>[]);
  for(const item of line.items){
    const center=item.x+item.width/2;
    let index=header.bounds.findIndex((b,i)=>i<header.bounds.length-1&&center>=b&&center<header.bounds[i+1]);
    if(index<0)continue;
    // Narration often uses the whitespace beyond a short header. Start-aligned
    // text can stay in narration, but never move a numeric amount between columns.
    const d=header.map.description;
    if(/[A-Za-z]/.test(item.text)&&item.x>=header.bounds[d]&&item.x<header.bounds[d+1]&&center>=header.bounds[d+1]){
      if(item.x+item.width>header.bounds[d+2])throw fail('PDF_LAYOUT_UNSUPPORTED','A narration overlaps multiple amount columns. Export this statement as CSV/XLSX or use a clearer, straight scan.');
      index=d;
    }
    cells[index].push(item.text);
  }
  return cells.map(c=>c.join(' ').trim());
}
function headerCompatible(header,fields){
  return fields.every(f=>header.map[f]>=0);
}

/** Pure geometry extractor shared by selectable PDFs and OCR word boxes. */
export function extractStatementPages(pages,{usedOCR=false}={}) {
  let first=null,fields=null,previousHeader=null,previousWidth=null;
  const rows=[],rowLocations=[],warnings=[];let continued=0,skipped=0,blankPages=0;
  for(let p=0;p<pages.length;p++){
    const page=pages[p],lines=textItemsToLines(page.items||[]);
    if(!lines.length){blankPages++;continue;}
    let header=null,started=false,lastRow=null,lastY=null,pageTransactions=0;
    for(const line of lines){
      const candidate=asHeader(line);
      if(candidate){
        if(!first){
          first=candidate;fields=Object.keys(FIELD_NAMES).filter(f=>candidate.map[f]>=0);
          rows.push(fields.map(f=>FIELD_NAMES[f]));rowLocations.push({page:p+1,line:line.line});
        }else if(!headerCompatible(candidate,fields)){
          throw fail('PDF_LAYOUT_UNSUPPORTED',`The transaction columns change on page ${p+1}. Import statements with different layouts separately, or use CSV/XLSX.`);
        }
        header=candidate;previousHeader=header;previousWidth=page.width;started=true;lastRow=null;continue;
      }
      if(!header){
        // A headerless continuation page may reuse the immediately preceding
        // geometry only at the same page width and when a date lands in its column.
        if(previousHeader&&(!page.width||!previousWidth||Math.abs(page.width-previousWidth)<2)){
          const trial=rowCells(line,previousHeader);
          if(dateLike(trial[previousHeader.map.date])){header=previousHeader;started=true;}
        }
        if(!header)continue;
      }
      const cells=rowCells(line,header),date=cells[header.map.date],description=cells[header.map.description];
      const monetary=['debit','credit','amount'].some(f=>header.map[f]>=0&&/\d/.test(cells[header.map[f]]));
      const summary=/^(?:opening balance|closing balance|balance brought forward|balance carried forward|grand totals?|statement totals?|totals?|page \d+(?: of \d+)?)\s*[:.-]?$/i.test(description||date);
      if(dateLike(date)||(!summary&&monetary&&(date||description))){
        const row=fields.map(f=>cells[header.map[f]]||'');
        rows.push(row);rowLocations.push({page:p+1,line:line.line});
        lastRow=row;lastY=line.y;pageTransactions++;continue;
      }
      const occupied=cells.map((v,i)=>v?i:-1).filter(i=>i>=0);
      const continuation=occupied.length===1&&occupied[0]===header.map.description&&lastRow&&lastY-line.y<=line.height*2.2&&lastY>line.y;
      if(continuation&&!/^(?:page\s*\d|opening balance|closing balance|total|continued|statement|end of)/i.test(description)){
        lastRow[fields.indexOf('description')]=(lastRow[fields.indexOf('description')]+' '+description).trim();lastY=line.y;continued++;continue;
      }
      if(started&&occupied.length){
        // Dates in an unexpected column imply a shifted table, not a safe row.
        if(cells.some((v,i)=>i!==header.map.date&&dateLike(v)))throw fail('PDF_LAYOUT_UNSUPPORTED',`The table alignment is unclear on page ${p+1}, line ${line.line}. Use CSV/XLSX, or a straight, higher-resolution scan.`);
        skipped++;
      }
    }
    if(!pageTransactions&&lines.length>4)warnings.push(`Page ${p+1} had no recognized transaction rows. Check that it contains only a cover page, summary, or notes.`);
  }
  if(!first||rows.length<2)throw fail('PDF_LAYOUT_UNSUPPORTED',usedOCR?'The scan was read, but a clear transaction table could not be identified. Use an upright, well-lit English statement showing Date, Description, and Debit/Credit or Amount headers; CSV/XLSX is the most reliable option.':'No supported transaction table was found. Use a statement with visible Date, Description, and Debit/Credit or Amount column headings, or export CSV/XLSX.');
  if(continued)warnings.push(`${continued} wrapped narration line${continued===1?' was':'s were'} joined to the preceding transaction.`);
  if(skipped)warnings.push(`${skipped} non-transaction line${skipped===1?' was':'s were'} excluded. Compare the extracted rows and totals with the original statement.`);
  if(blankPages)warnings.push(`${blankPages} blank or unreadable page${blankPages===1?' was':'s were'} found. Check the source for missing transactions.`);
  if(usedOCR)warnings.unshift('OCR can misread dates, decimal points, amounts, and debit/credit columns. Review every extracted row against the source before importing. English printed statements are supported; handwriting is not reliable.');
  return {rows,rowLocations,warnings,pages:pages.length,usedOCR};
}

async function loadPDF() {
  const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=base('./vendor/pdfjs/pdf.worker.min.mjs');
  return pdfjs;
}
async function makeOCR(onProgress,state) {
  const {default:{createWorker}}=await import('./vendor/tesseract/tesseract.esm.min.js');
  return createWorker('eng',1,{
    workerPath:base('./vendor/tesseract/worker.min.js'),corePath:base('./vendor/tesseract/core'),
    langPath:base('./vendor/tesseract/lang'),workerBlobURL:false,cacheMethod:'none',gzip:true,
    logger:m=>onProgress?.({stage:'ocr',...state,progress:m.progress||0,status:m.status}),
  });
}
function ocrItems(data,height) {
  const items=[];
  for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[]){
    const b=word.bbox;if(!b||!word.text?.trim())continue;
    items.push({str:word.text,width:b.x1-b.x0,height:b.y1-b.y0,transform:[1,0,0,1,b.x0,height-(line.baseline?.y0??b.y1)],confidence:word.confidence});
  }
  return items;
}
async function recognizeCanvas(canvas,worker) {
  const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});
  return {items:ocrItems(data,canvas.height),width:canvas.width,confidence:data.confidence};
}
function canvasFor(width,height) {
  const scale=Math.min(1,Math.sqrt(PIXEL_LIMIT/(width*height)));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));return canvas;
}
async function imageCanvas(file) {
  let bitmap;
  try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw fail('IMAGE_INVALID','This image could not be opened. Use a JPG, PNG, or WebP image.');}
  try{
    if(bitmap.width<250||bitmap.height<150)throw fail('IMAGE_TOO_SMALL','This image is too small to read reliably. Upload a full-size image or a PDF/CSV export.');
    const canvas=canvasFor(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas;
  }finally{bitmap.close();}
}
/** All statement bytes and OCR processing stay in the browser. Only bundled,
 * same-origin code, fonts and English recognition data are requested. */
export async function readStatementDocument(file,{password,onProgress}={}) {
  if(file.size>20*1024*1024)throw fail('FILE_TOO_LARGE','Choose a file smaller than 20 MB.');
  const isImage=/^image\/(jpeg|png|webp)$/.test(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name||'');
  const state={page:0,pages:1};let worker=null,task=null,doc=null,usedOCR=false,ocrCount=0;const pages=[],extraWarnings=[];
  const ocr=async(canvas)=>{
    usedOCR=true;ocrCount++;if(ocrCount>OCR_LIMIT)throw fail('OCR_TOO_MANY_PAGES',`Scanned imports are limited to ${OCR_LIMIT} pages per file. Split the PDF into smaller files, or use CSV/XLSX.`);
    onProgress?.({stage:'ocr',...state,progress:0});if(!worker)worker=await makeOCR(onProgress,state);
    const result=await recognizeCanvas(canvas,worker);
    if(result.confidence<80)extraWarnings.push(`OCR confidence is low on page ${state.page}; check every field carefully or upload a clearer image.`);
    return result;
  };
  try{
    onProgress?.({stage:'loading',...state});
    if(isImage){
      state.page=1;const canvas=await imageCanvas(file);
      try{pages.push(await ocr(canvas));}finally{canvas.width=canvas.height=0;}
    }else{
      const pdfjs=await loadPDF();
      task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),password,
        cMapUrl:base('./vendor/pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:base('./vendor/pdfjs/standard_fonts/'),
        useWasm:false,isEvalSupported:false,disableAutoFetch:true,disableStream:true,disableRange:true,
      });
      doc=await task.promise;state.pages=doc.numPages;
      if(doc.numPages>PDF_LIMIT)throw fail('PDF_TOO_MANY_PAGES',`PDF imports are limited to ${PDF_LIMIT} pages. Split the statement into smaller files.`);
      for(let n=1;n<=doc.numPages;n++){
        state.page=n;onProgress?.({stage:'extract',...state});const page=await doc.getPage(n),viewport=page.getViewport({scale:1});
        try{
          const content=await page.getTextContent(),items=content.items.filter(i=>typeof i.str==='string'&&i.str.trim());
          const lines=textItemsToLines(items),hasHeader=lines.some(line=>asHeader(line));
          // Use OCR when the page has no useful selectable table text. This also
          // catches scanned pages with a selectable bank logo or page number.
          if(!hasHeader&&!lines.some(line=>lineCells(line).some(cell=>dateLike(cell.text)))){
            const scale=Math.min(2.5,Math.sqrt(PIXEL_LIMIT/(viewport.width*viewport.height))),view=page.getViewport({scale});
            const canvas=canvasFor(view.width,view.height);
            try{await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;pages.push(await ocr(canvas));}
            finally{canvas.width=canvas.height=0;}
          }else pages.push({items,width:viewport.width});
        }finally{page.cleanup();}
      }
    }
    const result=extractStatementPages(pages,{usedOCR});result.warnings.push(...extraWarnings);return result;
  }catch(error){
    if(error.code&&typeof error.code==='string')throw error;
    if(error.name==='PasswordException')throw fail(error.code===2?'PDF_PASSWORD_INCORRECT':'PDF_PASSWORD_REQUIRED',error.code===2?'That PDF password did not work. Try the statement password supplied by your bank.':'This PDF is password protected. Enter its password to read it locally.');
    if(error.name==='InvalidPDFException')throw fail('PDF_INVALID','This file could not be read as a PDF. Download it again or use CSV/XLSX.');
    throw fail(usedOCR?'OCR_FAILED':'PDF_READ_FAILED',usedOCR?'The local OCR reader could not finish. Try a smaller, clearer image or use CSV/XLSX.':'The PDF reader could not finish. Try downloading the file again, or use CSV/XLSX.',{cause:error});
  }finally{
    if(worker)await worker.terminate().catch(()=>{});
    if(task)await task.destroy().catch(()=>{});
  }
}
export const readPdfStatement=readStatementDocument;

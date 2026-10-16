import {mkdir,copyFile,writeFile} from 'node:fs/promises';
await mkdir('dist/vendor/transformers',{recursive:true});
await copyFile('node_modules/@huggingface/transformers/dist/transformers.min.js','dist/vendor/transformers/transformers.min.js');
await copyFile('node_modules/@huggingface/transformers/LICENSE','dist/vendor/transformers/LICENSE');
await writeFile('dist/vendor/transformers/ONNX-LICENSE',`MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);
await copyFile('node_modules/@huggingface/tokenizers/LICENSE','dist/vendor/transformers/TOKENIZERS-LICENSE');
await copyFile('node_modules/@huggingface/jinja/LICENSE','dist/vendor/transformers/JINJA-LICENSE');
await writeFile('dist/vendor/transformers/NOTICE.txt','Transformers.js 4.3.1, Apache-2.0. https://github.com/huggingface/transformers.js\nBundled browser runtime includes ONNX Runtime (MIT), Hugging Face tokenizers (Apache-2.0) and Jinja (Apache-2.0).\nModel and WASM assets are fetched on explicit enable only. Pinned model revision is in semantic-worker.mjs.\n');

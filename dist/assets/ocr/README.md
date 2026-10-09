# OCR local empacotado

- tesseract.js 6.0.1: https://github.com/naptha/tesseract.js — Apache-2.0 (LICENSE-tesseract-js.md e avisos *.LICENSE.txt).
- tesseract.js-core 6.0.0: https://github.com/naptha/tesseract.js-core — Apache-2.0 (LICENSE-core.txt).
- eng.traineddata.gz: @tesseract.js-data/eng 1.0.0, variante 4.0.0_best_int; https://github.com/naptha/tessdata. Pacote de distribuição MIT; modelo Tesseract: https://github.com/tesseract-ocr/tessdata_best — Apache-2.0.

Todos os quatro cores *.wasm.js são mantidos para seleção de SIMD/LSTM pelo worker. Estes arquivos já embutem o WebAssembly; não precisam de arquivos .wasm separados. O build inclui o modelo .gz como binário e o servidor entrega application/gzip. A política CSP autoriza apenas workers locais e compilação WebAssembly, sem habilitar eval JavaScript.

OCR carregado sob demanda ao capturar um visor digital; nunca sobe fotos a um provedor externo. Não remover o worker, o modelo ou os cores ao copiar o projeto. Detalhes e limites de uso em docs/Registro-por-foto.md.
